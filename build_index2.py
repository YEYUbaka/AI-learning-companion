import sys
sys.path.insert(0, '/opt/zhixueban/backend')
import os
os.chdir('/opt/zhixueban/backend')

os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['OMP_NUM_THREADS'] = '1'

print('开始加载依赖...', flush=True)

from database import SessionLocal
from models.knowledge import KnowledgeDocument
from pathlib import Path
from datetime import datetime

print('依赖加载完成', flush=True)

db = SessionLocal()
corpus_dir = Path('/opt/zhixueban/backend/knowledge_base/corpus')

md_files = list(corpus_dir.rglob('*.md'))
print(f'找到 {len(md_files)} 个文件', flush=True)

indexed = 0
skipped = 0
failed = 0

for md_path in md_files:
    file_path_str = str(md_path)
    existing = db.query(KnowledgeDocument).filter(
        KnowledgeDocument.file_path == file_path_str
    ).first()

    if existing and existing.status == 'indexed':
        skipped += 1
        continue

    try:
        content = md_path.read_text(encoding='utf-8')
        title = md_path.stem
        grade_level = subject = topic = difficulty = None

        if content.startswith('---'):
            lines = content.split('\n')
            fm_end = -1
            for i, line in enumerate(lines[1:], 1):
                if line.strip() == '---':
                    fm_end = i
                    break
            if fm_end > 0:
                for line in lines[1:fm_end]:
                    if ':' in line:
                        k, v = line.split(':', 1)
                        k, v = k.strip(), v.strip()
                        if k == 'grade': grade_level = v
                        elif k == 'subject': subject = v
                        elif k == 'topic': topic = v
                        elif k == 'difficulty': difficulty = v
                        elif k == 'title': title = v

        if existing:
            doc = existing
        else:
            doc = KnowledgeDocument(
                title=title,
                file_path=file_path_str,
                grade_level=grade_level,
                subject=subject,
                topic=topic,
                difficulty=difficulty,
            )
            db.add(doc)
            db.flush()

        doc.status = 'indexed'
        doc.indexed_at = datetime.utcnow()
        db.commit()
        indexed += 1
        print(f'  [{indexed}] {md_path.name}', flush=True)

    except Exception as e:
        print(f'  [失败] {md_path.name}: {e}', flush=True)
        db.rollback()
        failed += 1

db.close()
print(f'\n完成！新增: {indexed}, 跳过: {skipped}, 失败: {failed}', flush=True)
