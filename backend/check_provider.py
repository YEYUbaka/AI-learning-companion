"""
诊断脚本：检查模型提供商配置
运行方式：python check_provider.py
"""
import os
from dotenv import load_dotenv

load_dotenv()

def check_provider(provider: str):
    """检查指定提供商的配置"""
    print(f"\n{'='*50}")
    print(f"检查 {provider.upper()} 配置")
    print(f"{'='*50}")
    
    if provider == "deepseek":
        api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("AI_API_KEY")
        base_url = os.getenv("DEEPSEEK_API_BASE_URL") or os.getenv("AI_API_BASE_URL", "https://api.deepseek.com/v1")
        model = os.getenv("DEEPSEEK_MODEL") or os.getenv("AI_MODEL", "deepseek-chat")
    elif provider == "moonshot":
        api_key = os.getenv("MOONSHOT_API_KEY")
        base_url = os.getenv("MOONSHOT_API_BASE_URL", "https://api.moonshot.cn/v1")
        model = os.getenv("MOONSHOT_MODEL", "moonshot-v1-8k")
    elif provider == "wenxin":
        api_key = os.getenv("WENXIN_API_KEY")
        base_url = os.getenv("WENXIN_API_BASE_URL", "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat")
        model = os.getenv("WENXIN_MODEL", "ernie-bot-turbo")
    elif provider == "xinghuo":
        api_key = os.getenv("XINGHUO_API_KEY")
        base_url = os.getenv("XINGHUO_API_BASE_URL", "https://spark-api.xf-yun.com/v1")
        model = os.getenv("XINGHUO_MODEL", "general")
    elif provider == "chatglm":
        api_key = os.getenv("CHATGLM_API_KEY")
        base_url = os.getenv("CHATGLM_API_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")
        model = os.getenv("CHATGLM_MODEL", "glm-4")
    else:
        print(f"❌ 不支持的提供商: {provider}")
        return
    
    print(f"API Key: {'✅ 已配置' if api_key else '❌ 未配置'}")
    if api_key:
        # 只显示前10个字符和后10个字符，中间用...代替
        if len(api_key) > 20:
            masked_key = api_key[:10] + "..." + api_key[-10:]
        else:
            masked_key = api_key[:5] + "***"
        print(f"  Key预览: {masked_key}")
    else:
        print(f"  ⚠️  需要在.env文件中配置 {provider.upper()}_API_KEY")
    
    print(f"Base URL: {base_url}")
    print(f"Model: {model}")
    
    if not api_key:
        print(f"\n❌ {provider.upper()} 未配置API密钥，无法使用")
        return False
    else:
        print(f"\n✅ {provider.upper()} 配置完整")
        return True

if __name__ == "__main__":
    print("="*50)
    print("模型提供商配置诊断工具")
    print("="*50)
    
    providers = ["deepseek", "moonshot", "wenxin", "xinghuo", "chatglm"]
    results = {}
    
    for provider in providers:
        results[provider] = check_provider(provider)
    
    print(f"\n{'='*50}")
    print("配置总结")
    print(f"{'='*50}")
    for provider, configured in results.items():
        status = "✅ 已配置" if configured else "❌ 未配置"
        print(f"{provider.upper():12} : {status}")
    
    print(f"\n当前默认提供商: {os.getenv('AI_PROVIDER', 'deepseek')}")
    print("\n提示：如果某个模型未配置，前端切换时会显示错误信息。")

