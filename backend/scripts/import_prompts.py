"""
导入提示词脚本
作者：智学伴开发团队
目的：将 seed_data 目录下的所有提示词文件导入到数据库
"""
import json
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from database import SessionLocal
from services.bootstrap_service import BootstrapService
from core.logger import logger


def load_all_prompt_files():
    """加载所有提示词文件"""
    seed_data_dir = project_root / "seed_data"
    prompt_files = [
        "prompts.json",
        "structured_prompts.json",
        "comprehensive_education_prompt.json"
    ]
    
    all_prompts = []
    
    for filename in prompt_files:
        file_path = seed_data_dir / filename
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        all_prompts.extend(data)
                        logger.info(f"✅ 已加载 {filename}: {len(data)} 个提示词")
                    else:
                        logger.warning(f"⚠️  {filename} 格式错误：根节点必须是数组")
            except Exception as e:
                logger.error(f"❌ 加载 {filename} 失败: {e}")
        else:
            logger.warning(f"⚠️  文件不存在: {file_path}")
    
    return all_prompts


def main():
    """主函数"""
    print("=" * 60)
    print("开始导入提示词...")
    print("=" * 60)
    
    # 加载所有提示词文件
    prompts = load_all_prompt_files()
    
    if not prompts:
        print("❌ 没有找到任何提示词文件")
        return
    
    print(f"\n📋 共找到 {len(prompts)} 个提示词")
    for prompt in prompts:
        print(f"  - {prompt.get('name', '未知')}: {prompt.get('description', '无描述')}")
    
    # 导入到数据库
    db = SessionLocal()
    try:
        changes = BootstrapService.sync_prompts_from_data(db, prompts)
        db.commit()
        print(f"\n✅ 导入完成！共处理 {changes} 个提示词")
        print("\n提示：")
        print("  - 如果提示词已存在且内容相同，只会更新描述和状态")
        print("  - 如果提示词内容不同，会创建新版本")
        print("  - 可以通过管理后台查看和管理这些提示词")
    except Exception as e:
        db.rollback()
        print(f"\n❌ 导入失败: {e}")
        logger.error(f"导入提示词失败: {e}", exc_info=True)
    finally:
        db.close()


if __name__ == "__main__":
    main()

