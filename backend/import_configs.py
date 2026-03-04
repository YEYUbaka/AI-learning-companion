"""
导入模型配置和提示词到数据库
"""
import os
import json
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import ModelConfig, Prompt
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

def import_model_configs():
    """导入模型配置"""
    db = SessionLocal()

    try:
        # 读取模型配置文件
        with open('seed_data/models.json', 'r', encoding='utf-8') as f:
            models_data = json.load(f)

        print("开始导入模型配置...")

        # 清空现有配置（可选）
        db.query(ModelConfig).delete()
        db.commit()

        # 导入新配置
        for model_data in models_data:
            # 替换环境变量
            api_key_var = model_data['api_key']
            if api_key_var.startswith('${') and api_key_var.endswith('}'):
                env_var_name = api_key_var[2:-1]
                actual_api_key = os.getenv(env_var_name)

                # 根据提供商名称匹配正确的环境变量
                if model_data['provider_name'] == 'DeepSeek':
                    actual_api_key = os.getenv('AI_API_KEY')
                elif model_data['provider_name'] == '文心一言':
                    actual_api_key = os.getenv('WENXIN_API_KEY')
                elif model_data['provider_name'] == '星火':
                    actual_api_key = os.getenv('XINGHUO_API_KEY')
                elif model_data['provider_name'] == '智谱清言':
                    actual_api_key = os.getenv('CHATGLM_API_KEY')
                elif model_data['provider_name'] == 'Kimi':
                    actual_api_key = os.getenv('MOONSHOT_API_KEY')
            else:
                actual_api_key = model_data['api_key']

            # 创建模型配置
            model_config = ModelConfig(
                provider_name=model_data['provider_name'],
                api_key=actual_api_key,
                base_url=model_data['base_url'],
                priority=model_data['priority'],
                enabled=model_data['enabled'],
                params=model_data['params']
            )

            db.add(model_config)
            print(f"[OK] 导入模型: {model_data['provider_name']}")

        db.commit()
        print(f"\n成功导入 {len(models_data)} 个模型配置")

    except Exception as e:
        print(f"[ERROR] 导入模型配置失败: {str(e)}")
        db.rollback()
    finally:
        db.close()

def import_prompts():
    """导入提示词配置"""
    db = SessionLocal()

    try:
        # 读取提示词配置文件
        with open('seed_data/prompts.json', 'r', encoding='utf-8') as f:
            prompts_data = json.load(f)

        print("\n开始导入提示词配置...")

        # 清空现有配置（可选）
        db.query(Prompt).delete()
        db.commit()

        # 导入新配置
        for prompt_data in prompts_data:
            prompt = Prompt(
                name=prompt_data['name'],
                content=prompt_data['content'],
                description=prompt_data.get('description', ''),
                author=prompt_data.get('author', 'system'),
                version=1,
                enabled=prompt_data.get('enabled', True)
            )

            db.add(prompt)
            print(f"[OK] 导入提示词: {prompt_data['name']}")

        db.commit()
        print(f"\n成功导入 {len(prompts_data)} 个提示词配置")

    except Exception as e:
        print(f"[ERROR] 导入提示词配置失败: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("="*60)
    print("开始导入配置到数据库")
    print("="*60)

    import_model_configs()
    import_prompts()

    print("\n" + "="*60)
    print("配置导入完成")
    print("="*60)
