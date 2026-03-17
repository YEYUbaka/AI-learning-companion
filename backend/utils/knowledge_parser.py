"""
知识文件解析器 - 解析 Markdown + YAML frontmatter 格式的知识文件
"""
import re
import os
import shutil
import hashlib
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field


@dataclass
class ParsedChunk:
    """解析后的文档分块"""
    text: str
    section_title: str
    chunk_index: int
    image_paths: List[str] = field(default_factory=list)


@dataclass
class ParsedDocument:
    """解析后的文档"""
    title: str
    file_path: str
    grade_level: Optional[str]
    subject: Optional[str]
    topic: Optional[str]
    difficulty: Optional[str]
    source: Optional[str]
    tags: List[str]
    chunks: List[ParsedChunk]


def parse_knowledge_file(file_path: str, chunk_size: int = 500, overlap: int = 50) -> ParsedDocument:
    """
    解析知识文件（Markdown + YAML frontmatter）

    Args:
        file_path: 文件路径（绝对路径）
        chunk_size: 每个分块的最大字符数
        overlap: 相邻分块的重叠字符数

    Returns:
        ParsedDocument 对象
    """
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 提取 frontmatter
    metadata = _extract_frontmatter(content)
    # 去除 frontmatter，获取正文
    body = _strip_frontmatter(content)

    # 按标题切割为段落
    sections = _split_by_heading(body)

    # 提取所有图片路径
    doc_dir = os.path.dirname(file_path)

    # 将每个段落切割为 chunks
    chunks = []
    chunk_index = 0
    for section_title, section_content in sections:
        # 提取该段落内的图片路径
        image_paths = _extract_image_paths(section_content, doc_dir)

        # 切割文本
        text_chunks = _split_into_chunks(section_content, chunk_size, overlap)
        for text in text_chunks:
            # 清理文本中的图片 Markdown 语法，保留文字描述
            clean_text = _clean_image_syntax(text)
            chunks.append(ParsedChunk(
                text=clean_text,
                section_title=section_title,
                chunk_index=chunk_index,
                image_paths=image_paths
            ))
            chunk_index += 1

    return ParsedDocument(
        title=metadata.get("title", os.path.basename(file_path)),
        file_path=file_path,
        grade_level=metadata.get("grade_level"),
        subject=metadata.get("subject"),
        topic=metadata.get("topic"),
        difficulty=metadata.get("difficulty"),
        source=metadata.get("source"),
        tags=metadata.get("tags", []),
        chunks=chunks
    )


def copy_images_to_pool(file_path: str, image_pool_dir: str) -> Dict[str, str]:
    """
    将文档引用的图片复制到全局图片池，返回原路径→新路径的映射

    Args:
        file_path: 文档路径
        image_pool_dir: 全局图片池目录

    Returns:
        {原始相对路径: 新的相对路径（相对于 image_pool_dir）}
    """
    os.makedirs(image_pool_dir, exist_ok=True)
    doc_dir = os.path.dirname(file_path)

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 找到所有图片引用
    img_pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    path_map = {}

    for match in img_pattern.finditer(content):
        img_path = match.group(2)
        if img_path.startswith("http://") or img_path.startswith("https://"):
            continue  # 跳过网络图片

        # 解析为绝对路径
        abs_img_path = os.path.normpath(os.path.join(doc_dir, img_path))
        if not os.path.exists(abs_img_path):
            continue

        # 计算 hash，防止重名
        with open(abs_img_path, "rb") as f:
            file_hash = hashlib.md5(f.read()).hexdigest()[:8]

        ext = os.path.splitext(abs_img_path)[1].lower()
        new_name = f"{file_hash}{ext}"
        new_abs_path = os.path.join(image_pool_dir, new_name)

        if not os.path.exists(new_abs_path):
            shutil.copy2(abs_img_path, new_abs_path)

        path_map[img_path] = new_name

    return path_map


# ─── 内部辅助函数 ───────────────────────────────────────────────────────────────

def _extract_frontmatter(content: str) -> Dict[str, Any]:
    """提取 YAML frontmatter"""
    pattern = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)
    match = pattern.match(content)
    if not match:
        return {}

    try:
        import yaml
        return yaml.safe_load(match.group(1)) or {}
    except Exception:
        # 如果 yaml 未安装，手动解析简单键值对
        result = {}
        for line in match.group(1).splitlines():
            if ":" in line:
                key, _, val = line.partition(":")
                result[key.strip()] = val.strip().strip('"')
        return result


def _strip_frontmatter(content: str) -> str:
    """去除 frontmatter，返回正文"""
    pattern = re.compile(r'^---\s*\n.*?\n---\s*\n', re.DOTALL)
    return pattern.sub("", content).strip()


def _split_by_heading(content: str) -> List[tuple]:
    """
    按 Markdown 标题切割内容

    Returns:
        List of (section_title, section_content)
    """
    # 匹配所有标题
    heading_pattern = re.compile(r'^(#{1,3})\s+(.+)$', re.MULTILINE)
    matches = list(heading_pattern.finditer(content))

    if not matches:
        return [("正文", content)]

    sections = []
    for i, match in enumerate(matches):
        title = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        section_content = content[start:end].strip()
        if section_content:
            sections.append((title, section_content))

    # 如果标题之前有内容（前言），也作为一个段落
    if matches[0].start() > 0:
        preamble = content[:matches[0].start()].strip()
        if preamble:
            sections.insert(0, ("前言", preamble))

    return sections if sections else [("正文", content)]


def _split_into_chunks(text: str, chunk_size: int, overlap: int) -> List[str]:
    """将文本切割为固定大小的分块（带重叠）"""
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk)
        if end >= len(text):
            break
        start = end - overlap  # 回退 overlap 个字符，形成重叠

    return chunks


def _extract_image_paths(text: str, doc_dir: str) -> List[str]:
    """提取文本中的图片路径，返回绝对路径列表"""
    pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    paths = []
    for match in pattern.finditer(text):
        img_path = match.group(2)
        if img_path.startswith("http://") or img_path.startswith("https://"):
            continue
        abs_path = os.path.normpath(os.path.join(doc_dir, img_path))
        if os.path.exists(abs_path):
            paths.append(abs_path)
    return paths


def _clean_image_syntax(text: str) -> str:
    """将图片 Markdown 语法替换为文字描述（保留 alt text）"""
    pattern = re.compile(r'!\[([^\]]*)\]\([^)]+\)')
    return pattern.sub(lambda m: f"[图片：{m.group(1)}]" if m.group(1) else "[图片]", text)
