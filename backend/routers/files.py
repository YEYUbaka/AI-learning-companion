"""
文件上传路由
处理文件上传和解析
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
import os
import shutil
from typing import Optional
from utils.file_parser import parse_file, get_file_info

router = APIRouter(prefix="/api/v1/files", tags=["文件上传"])

# 上传文件保存目录
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 允许的文件类型
ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.md', '.markdown', '.docx', '.pptx'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    上传文件并解析内容
    
    Args:
        file: 上传的文件
        
    Returns:
        dict: 文件信息和解析结果
    """
    try:
        # 检查文件类型
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件类型: {file_ext}。支持的类型: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # 保存文件
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        
        # 如果文件已存在，添加时间戳
        if os.path.exists(file_path):
            import time
            name, ext = os.path.splitext(file.filename)
            file_path = os.path.join(UPLOAD_DIR, f"{name}_{int(time.time())}{ext}")
        
        # 读取并保存文件
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 检查文件大小
        file_size = os.path.getsize(file_path)
        if file_size > MAX_FILE_SIZE:
            os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件过大: {file_size / 1024 / 1024:.2f}MB，最大允许: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        # 解析文件内容
        try:
            text_content, text_length = parse_file(file_path)
            print(f"[INFO] 文件解析成功: {file.filename}, 提取文本长度: {text_length} 字符")
        except ValueError as e:
            # 如果解析失败（不支持的类型或内容为空），删除文件
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件解析失败: {str(e)}"
            )
        except Exception as e:
            # 其他解析错误
            if os.path.exists(file_path):
                os.remove(file_path)
            print(f"[ERROR] 文件解析异常: {file.filename}, 错误: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"文件解析失败: {str(e)}"
            )
        
        # 返回结果
        return JSONResponse({
            "success": True,
            "file_name": file.filename,
            "file_path": file_path,
            "file_size": file_size,
            "text_length": text_length,
            "text_preview": text_content[:200] + "..." if len(text_content) > 200 else text_content,
            "message": "文件上传并解析成功"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件上传失败: {str(e)}"
        )


@router.get("/info/{file_name}")
async def get_file_info_endpoint(file_name: str):
    """
    获取文件信息
    
    Args:
        file_name: 文件名
        
    Returns:
        dict: 文件信息
    """
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在"
        )
    
    try:
        info = get_file_info(file_path)
        return JSONResponse({
            "success": True,
            "file_info": info
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文件信息失败: {str(e)}"
        )

