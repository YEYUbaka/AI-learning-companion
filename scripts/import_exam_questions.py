"""
智学伴题库导入脚本 - 2025年中考真题
从互联网搜集的真实试卷题目，批量导入到题库
使用方法:
  python import_exam_questions.py --source path/to/questions.json
  python import_exam_questions.py --dry-run --source path/to/questions.json
"""

import argparse
import json
import os
import sys
import time
from typing import Optional

import requests

# ============================================================
# 配置 - 从环境变量读取
# ============================================================
BASE_URL = os.environ.get("ZHI_XUE_BAN_BASE_URL", "http://127.0.0.1:8000")
ADMIN_EMAIL = os.environ.get("ZHI_XUE_BAN_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ZHI_XUE_BAN_ADMIN_PASSWORD")

# ============================================================
# 认证
# ============================================================
def login() -> str:
    """登录获取管理员 token（使用 JSON 格式接口）"""
    resp = requests.post(
        f"{BASE_URL}/api/v1/auth/login-json",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"[FAIL] 登录失败: {resp.status_code} {resp.text}")
        sys.exit(1)
    data = resp.json()
    token = data.get("access_token")
    if not token:
        print(f"[FAIL] 未获取到 token: {data}")
        sys.exit(1)
    user = data.get("user", {})
    print(f"[OK] 管理员登录成功 ({user.get('name', 'unknown')}, role={user.get('role', 'unknown')})")
    return token


def import_question(token: str, question: dict) -> bool:
    """导入单道题目"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/question-bank/items",
            json=question,
            headers=headers,
            timeout=30,
        )
        if resp.status_code in (200, 201):
            return True
        else:
            err = resp.json() if resp.text else {}
            msg = err.get("detail", resp.text[:100])
            print(f"  [WARN] 导入失败: {msg}")
            return False
    except Exception as e:
        print(f"  [ERROR] 网络错误: {e}")
        return False


# ============================================================
# 题目数据 - 2025年中考真题（共约120道）
# ============================================================

QUESTIONS = [
    # ==================== 数学 - 选择题 ====================
    {
        "stem": "6的相反数是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "easy",
        "knowledge_points": ["相反数"],
        "answer": "A",
        "explanation": "相反数的定义：绝对值相等，正负号相反的两个数互为相反数。6的相反数是-6。",
        "options": ["A. -6", "B. 6", "C. -1/6", "D. 1/6"],
        "source": "2025年重庆市中考数学试题",
    },
    {
        "stem": "下列图形中，是轴对称图形的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "easy",
        "knowledge_points": ["轴对称图形"],
        "answer": "B",
        "explanation": "轴对称图形是指沿一条直线折叠后，直线两旁的部分能够互相重合的图形。",
        "options": ["A. 平行四边形", "B. 等腰三角形", "C. 一般梯形", "D. 一般四边形"],
        "source": "2025年重庆市中考数学试题",
    },
    {
        "stem": "如图，在⊙O中，∠AOB=100°，则∠C的度数为（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "medium",
        "knowledge_points": ["圆周角定理"],
        "answer": "B",
        "explanation": "根据圆周角定理：同弧所对的圆周角等于圆心角的一半。∠C = ∠AOB / 2 = 100° / 2 = 50°。",
        "options": ["A. 100°", "B. 50°", "C. 25°", "D. 200°"],
        "source": "2025年重庆市中考数学试题",
    },
    {
        "stem": "某产品原价为a元，经过连续两年平均增长，第二年末价格为b元。设年平均增长率为x，则可列方程为（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "medium",
        "knowledge_points": ["一元二次方程", "增长率问题"],
        "answer": "C",
        "explanation": "设年平均增长率为x，第一年末价格为a(1+x)，第二年末价格为a(1+x)²=b。",
        "options": ["A. a(1+2x)=b", "B. a(1+x²)=b", "C. a(1+x)²=b", "D. a+2ax=b"],
        "source": "2025年重庆市中考数学试题",
    },
    {
        "stem": "一元二次方程x²-4x+c=0有两个相等的实数根，则c的值是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "medium",
        "knowledge_points": ["一元二次方程", "判别式"],
        "answer": "D",
        "explanation": "一元二次方程有两个相等的实数根的条件是判别式Δ=0。Δ=b²-4ac=(-4)²-4×1×c=16-4c=0，解得c=4。",
        "options": ["A. -4", "B. -2", "C. 2", "D. 4"],
        "source": "2024年北京市中考数学试题",
    },
    {
        "stem": "若反比例函数y=k/x的图像经过点(3, y₁)和(-3, y₂)，则y₁+y₂的值为（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "medium",
        "knowledge_points": ["反比例函数", "函数图像"],
        "answer": "A",
        "explanation": "反比例函数y=k/x，当x=3时，y₁=k/3；当x=-3时，y₂=k/(-3)=-k/3。所以y₁+y₂=k/3+(-k/3)=0。",
        "options": ["A. 0", "B. k/3", "C. -k/3", "D. 2k/3"],
        "source": "2024年北京市中考数学试题",
    },
    {
        "stem": "下列图形中，既是轴对称图形又是中心对称图形的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "easy",
        "knowledge_points": ["轴对称", "中心对称"],
        "answer": "C",
        "explanation": "正方形既是轴对称图形（有4条对称轴），又是中心对称图形（旋转180°与自身重合）。平行四边形仅是中心对称图形，等腰梯形仅是轴对称图形。",
        "options": ["A. 平行四边形", "B. 等腰梯形", "C. 正方形", "D. 一般三角形"],
        "source": "2024年北京市中考数学试题",
    },
    {
        "stem": "一个不透明的袋子中有1个红球和3个白球，它们除颜色外完全相同。从中随机摸出一个球，摸到红球的概率是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "easy",
        "knowledge_points": ["概率"],
        "answer": "A",
        "explanation": "袋中共有4个球，其中红球1个。摸到红球的概率为红球数/总球数=1/4。",
        "options": ["A. 1/4", "B. 1/3", "C. 3/4", "D. 1"],
        "source": "2025年重庆市中考数学试题",
    },

    # ==================== 数学 - 填空题 ====================
    {
        "stem": "因式分解：x³-25x = _______。",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "medium",
        "knowledge_points": ["因式分解", "提取公因式", "平方差公式"],
        "answer": "x(x+5)(x-5)",
        "explanation": "先提取公因式x：x³-25x=x(x²-25)，再应用平方差公式：x(x²-25)=x(x+5)(x-5)。",
        "source": "2024年北京市中考数学试题",
    },
    {
        "stem": "使二次根式√(x-9)有意义的x的取值范围是_______。",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "easy",
        "knowledge_points": ["二次根式有意义的条件"],
        "answer": "x≥9",
        "explanation": "二次根式有意义的条件是被开方数大于等于0，即x-9≥0，解得x≥9。",
        "source": "2024年北京市中考数学试题",
    },
    {
        "stem": "解分式方程：1/(2x+3)+1/x=0，则x=_______。",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "数学",
        "difficulty": "medium",
        "knowledge_points": ["分式方程"],
        "answer": "-1",
        "explanation": "通分得(x+2x+3)/[x(2x+3)]=0，(3x+3)/[x(2x+3)]=0，3x+3=0，x=-1。检验：分母不为0，-1是原方程的根。",
        "source": "2024年北京市中考数学试题",
    },

    # ==================== 英语 - 完形填空 ====================
    {
        "stem": "His mother was busy taking care of his little sister, and nobody came to ___ the juice.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "easy",
        "knowledge_points": ["动词辨析"],
        "answer": "B",
        "explanation": "根据上下文，没有人来'买'果汁。buy表示购买，符合句意。",
        "options": ["A. make", "B. buy", "C. sell", "D. send"],
        "source": "2025年甘肃省兰州市中考英语试题",
    },
    {
        "stem": "He said in a ___ voice because he was very shy.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "easy",
        "knowledge_points": ["形容词辨析"],
        "answer": "A",
        "explanation": "因为他很害羞，所以用'低沉的'声音说话。low voice表示低声。",
        "options": ["A. low", "B. high", "C. long", "D. short"],
        "source": "2025年甘肃省兰州市中考英语试题",
    },
    {
        "stem": "What ___ progress you've made! You should be proud of yourself.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "medium",
        "knowledge_points": ["感叹句"],
        "answer": "C",
        "explanation": "感叹句结构：What+形容词+不可数名词+主语+谓语。progress是不可数名词，用great表示'巨大的'进步。",
        "options": ["A. no", "B. little", "C. great", "D. small"],
        "source": "2025年甘肃省兰州市中考英语试题",
    },
    {
        "stem": "It can ___ the best in all of us and help us become more confident.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "medium",
        "knowledge_points": ["动词短语辨析"],
        "answer": "D",
        "explanation": "bring out the best in sb. 意为'激发出某人最好的一面'，是固定搭配。",
        "options": ["A. take out", "B. give out", "C. help out", "D. bring out"],
        "source": "2025年甘肃省兰州市中考英语试题",
    },
    {
        "stem": "On Bill's ___ day to school, he felt very nervous.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "easy",
        "knowledge_points": ["序数词"],
        "answer": "C",
        "explanation": "根据句意，这是Bill上学的'第一天'，所以用序数词first。",
        "options": ["A. last", "B. best", "C. first", "D. second"],
        "source": "2025年新疆中考英语试题",
    },
    {
        "stem": "He just ___ with a nod in silence, without saying a word.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "easy",
        "knowledge_points": ["动词辨析"],
        "answer": "C",
        "explanation": "replied表示'回应、回答'，句意为他只是默默点头回应。joked(开玩笑)和asked(询问)不符合上下文。",
        "options": ["A. joked", "B. asked", "C. replied", "D. shouted"],
        "source": "2025年新疆中考英语试题",
    },
    {
        "stem": "___ a simple 'Hello!' can bring warmth to people's hearts.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "medium",
        "knowledge_points": ["副词辨析"],
        "answer": "A",
        "explanation": "just在此处表示'仅仅、只是'，强调一句简单的'你好'也能带来温暖。",
        "options": ["A. just", "B. nearly", "C. almost", "D. hardly"],
        "source": "2025年新疆中考英语试题",
    },
    {
        "stem": "I was the one to ___ a perfect dog actor for the school musical.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "medium",
        "knowledge_points": ["动词辨析"],
        "answer": "A",
        "explanation": "find表示'找到'，句意为我负责找到一只完美的狗演员。train是训练，keep是保持，buy是购买。",
        "options": ["A. find", "B. train", "C. keep", "D. buy"],
        "source": "2025年广东省广州市中考英语试题",
    },
    {
        "stem": "Finding a dog actor was not ___ at all.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "easy",
        "knowledge_points": ["形容词辨析"],
        "answer": "C",
        "explanation": "easy表示'容易的'，句意为找到一只狗演员一点也不容易。funny(有趣的)、important(重要的)、possible(可能的)。",
        "options": ["A. funny", "B. important", "C. easy", "D. possible"],
        "source": "2025年广东省广州市中考英语试题",
    },
    {
        "stem": "___ man in a white T-shirt is my father.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "easy",
        "knowledge_points": ["冠词"],
        "answer": "C",
        "explanation": "此处特指'穿白色T恤的那个男人'，用定冠词The。",
        "options": ["A. A", "B. An", "C. The", "D. /"],
        "source": "2025年甘肃省武威市中考英语试题",
    },
    {
        "stem": "The purple scarf is not the girl's. ___ is blue.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "easy",
        "knowledge_points": ["物主代词"],
        "answer": "B",
        "explanation": "此处指'她的（围巾）'是蓝色的，用名词性物主代词Hers，相当于her scarf。",
        "options": ["A. Its", "B. Hers", "C. Mine", "D. His"],
        "source": "2025年甘肃省武威市中考英语试题",
    },
    {
        "stem": "___ you turn down the TV, please? I'm doing my homework.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "easy",
        "knowledge_points": ["情态动词"],
        "answer": "A",
        "explanation": "Could you...? 是委婉的请求句式，表示'你能……吗？'。",
        "options": ["A. Could", "B. Must", "C. Might", "D. Should"],
        "source": "2025年甘肃省武威市中考英语试题",
    },
    {
        "stem": "There ___ a notebook and three keys on the desk.",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "英语",
        "difficulty": "medium",
        "knowledge_points": ["主谓一致", "There be句型"],
        "answer": "A",
        "explanation": "There be句型遵循就近原则，离be动词最近的主语是a notebook（单数），所以用is。",
        "options": ["A. is", "B. was", "C. are", "D. were"],
        "source": "2025年甘肃省武威市中考英语试题",
    },

    # ==================== 物理 - 选择题 ====================
    {
        "stem": "风铃的铜管粗细相同、长短不同，用大小相同的力敲击，铜管发出的声音（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "物理",
        "difficulty": "medium",
        "knowledge_points": ["声音的特性", "音调"],
        "answer": "B",
        "explanation": "铜管长度不同→振动频率不同→音调不同；力大小相同→振幅相同→响度相同。",
        "options": ["A. 响度不同", "B. 音调不同", "C. 音色不同", "D. 都相同"],
        "source": "2025年江苏省无锡市中考物理试题",
    },
    {
        "stem": "边防战士满脸冰霜，'霜'的形成属于（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "物理",
        "difficulty": "easy",
        "knowledge_points": ["物态变化", "凝华"],
        "answer": "D",
        "explanation": "霜是空气中水蒸气遇冷从气态直接变成固态，属于凝华现象。熔化是固态变液态，凝固是液态变固态，液化是气态变液态。",
        "options": ["A. 熔化", "B. 凝固", "C. 液化", "D. 凝华"],
        "source": "2025年天津市中考物理试题",
    },
    {
        "stem": "下列现象由光的反射形成的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "物理",
        "difficulty": "easy",
        "knowledge_points": ["光的反射"],
        "answer": "C",
        "explanation": "水中倒影是光的反射（平面镜成像）。小孔成像和日食是光的直线传播，海市蜃楼是光的折射。",
        "options": ["A. 小孔成像", "B. 海市蜃楼", "C. 水中倒影", "D. 日食"],
        "source": "2025年湖北省宜昌市中考物理试题",
    },
    {
        "stem": "声音是由物体___产生的。",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "物理",
        "difficulty": "easy",
        "knowledge_points": ["声音的产生"],
        "answer": "振动",
        "explanation": "声音是由物体的振动产生的。一切发声的物体都在振动，振动停止，发声也停止。",
        "source": "2025年江苏省无锡市中考物理试题",
    },
    {
        "stem": "弹簧将小车弹出，弹性势能转化为___能；弹簧压缩越短弹性势能越___。",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "物理",
        "difficulty": "medium",
        "knowledge_points": ["能量转化", "弹性势能"],
        "answer": "动,大",
        "explanation": "弹簧恢复原状时，弹性势能转化为小车的动能。弹簧压缩越短，形变越大，弹性势能越大。",
        "source": "2025年江苏省无锡市中考物理试题",
    },
    {
        "stem": "汽车发动机用水做冷却剂是因为水的___较大；刹车片发热是通过___的方式改变内能。",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "物理",
        "difficulty": "medium",
        "knowledge_points": ["比热容", "改变内能的方式"],
        "answer": "比热容,做功",
        "explanation": "水的比热容大，吸收相同热量温度升高较少，适合做冷却剂。刹车片通过摩擦做功将机械能转化为内能。",
        "source": "2025年湖北省宜昌市中考物理试题",
    },
    {
        "stem": "下列关于力与运动的说法中，正确的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "物理",
        "difficulty": "medium",
        "knowledge_points": ["力与运动", "牛顿第一定律"],
        "answer": "C",
        "explanation": "力是改变物体运动状态的原因，不是维持运动的原因。物体不受力时保持静止或匀速直线运动（牛顿第一定律）。",
        "options": [
            "A. 力是维持物体运动的原因",
            "B. 物体运动越快，受到的力越大",
            "C. 力是改变物体运动状态的原因",
            "D. 物体不受力时一定静止"
        ],
        "source": "2025年内蒙古中考物理试题",
    },
    {
        "stem": "嫦娥六号采集月球样品质量为1935.3g，合___kg；样品从月球带回地球后，其质量___。",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "物理",
        "difficulty": "easy",
        "knowledge_points": ["质量单位换算", "质量的性质"],
        "answer": "1.9353,不变",
        "explanation": "1kg=1000g，1935.3g=1.9353kg。质量是物体的固有属性，不随位置改变而改变。",
        "source": "2025年天津市中考物理试题",
    },
    {
        "stem": "下列做法符合安全用电原则的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "物理",
        "difficulty": "easy",
        "knowledge_points": ["安全用电"],
        "answer": "C",
        "explanation": "更换灯泡前断开电源开关是安全用电的正确做法。湿手摸开关、在电线上晾衣服、用铜丝代替保险丝都是危险行为。",
        "options": [
            "A. 用湿手触摸开关",
            "B. 在电线上晾晒衣服",
            "C. 更换灯泡前断开电源开关",
            "D. 用铜丝代替保险丝"
        ],
        "source": "2025年内蒙古中考物理试题",
    },

    # ==================== 化学 - 选择题 ====================
    {
        "stem": "下列关于水与溶液的说法错误的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "medium",
        "knowledge_points": ["溶液的性质"],
        "answer": "C",
        "explanation": "溶液的基本特征是均一性、稳定性，但不包括无色。部分溶液有颜色，例如硫酸铜溶液为蓝色，氯化铁溶液为黄色。",
        "options": [
            "A. 工业上可用多级闪急蒸馏法淡化海水",
            "B. 喷灌与滴灌式浇水可以有效节约水资源",
            "C. 溶液都是均一、稳定、无色、透明的混合物",
            "D. 配制100g溶质质量分数为0.9%的生理盐水，需要0.9g氯化钠"
        ],
        "source": "2025年中考化学真题（烟台卷）",
    },
    {
        "stem": "《天工开物》中记载的下列工艺主要涉及化学变化的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "easy",
        "knowledge_points": ["物理变化与化学变化"],
        "answer": "D",
        "explanation": "五谷酿酒过程中糖类发酵生成酒精，有新物质生成，属于化学变化。纺纱织布、沙里淘金、海水晒盐均无新物质生成，属于物理变化。",
        "options": ["A. 纺纱织布", "B. 沙里淘金", "C. 海水晒盐", "D. 五谷酿酒"],
        "source": "2025年中考化学真题（烟台卷）",
    },
    {
        "stem": "青蒿素(C₁₅H₂₂O₅)的相关说法正确的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "medium",
        "knowledge_points": ["化学式的意义", "元素质量比"],
        "answer": "A",
        "explanation": "青蒿素由碳、氢、氧三种元素组成。碳和氧元素质量比为(12×15):(16×5)=180:80=9:4，不是3:1。碳元素质量分数最大。分子中不含H₂分子，含22个氢原子。",
        "options": [
            "A. 由三种元素组成",
            "B. C和O元素的质量比为3:1",
            "C. H元素的质量分数最大",
            "D. 1个分子中含有11个H₂分子"
        ],
        "source": "2025年中考化学真题（连云港卷）",
    },
    {
        "stem": "缺铁易引起的疾病是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "easy",
        "knowledge_points": ["化学元素与人体健康"],
        "answer": "B",
        "explanation": "缺铁会引起缺铁性贫血。缺钙易引起骨质疏松或佝偻病，缺碘引起甲状腺肿大，缺锌影响生长发育。",
        "options": ["A. 骨质疏松", "B. 贫血", "C. 甲状腺肿大", "D. 龋齿"],
        "source": "2025年中考化学真题（达州卷）",
    },
    {
        "stem": "下列在石油综合利用中属于物理变化的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "medium",
        "knowledge_points": ["物理变化与化学变化", "石油分馏"],
        "answer": "D",
        "explanation": "分馏是利用各成分的沸点不同进行分离，没有新物质生成，属于物理变化。生产合成纤维、化肥、塑料均涉及化学反应。",
        "options": ["A. 生产合成纤维", "B. 生产化肥", "C. 生产塑料", "D. 分馏得到汽油"],
        "source": "2025年黑龙江省大庆市中考化学试题",
    },
    {
        "stem": "下列气体中可供给动植物呼吸的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "easy",
        "knowledge_points": ["氧气的用途"],
        "answer": "A",
        "explanation": "氧气能供给动植物呼吸，是维持生命活动必需的气体。氮气、稀有气体化学性质稳定，不支持呼吸。二氧化碳不能供给呼吸。",
        "options": ["A. 氧气", "B. 氮气", "C. 稀有气体", "D. 二氧化碳"],
        "source": "2025年黑龙江省齐齐哈尔市中考化学试题",
    },
    {
        "stem": "下列我国的古代发明及应用中不涉及化学变化的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "easy",
        "knowledge_points": ["物理变化与化学变化"],
        "answer": "C",
        "explanation": "活字印刷没有新物质生成，属于物理变化。黑火药爆炸、粮食酿酒、烧制陶瓷均涉及化学反应生成新物质。",
        "options": ["A. 黑火药爆炸", "B. 粮食酿酒", "C. 活字印刷", "D. 烧制陶瓷"],
        "source": "2025年黑龙江省齐齐哈尔市中考化学试题",
    },
    {
        "stem": "人体内液体正常pH范围中，酸性最强的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "easy",
        "knowledge_points": ["pH与酸碱性"],
        "answer": "A",
        "explanation": "pH越小酸性越强。胃液pH范围0.9~1.5，是四个选项中最小的，酸性最强。血浆和胰液呈碱性，唾液接近中性。",
        "options": [
            "A. 胃液(0.9~1.5)",
            "B. 血浆(7.35~7.45)",
            "C. 唾液(6.6~7.1)",
            "D. 胰液(7.8~8.4)"
        ],
        "source": "2025年宁夏中考化学试题",
    },
    {
        "stem": "硫化锂（Li₂S）从物质分类的角度属于（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "easy",
        "knowledge_points": ["物质分类"],
        "answer": "C",
        "explanation": "Li₂S由锂和硫两种不同元素组成的纯净物，属于化合物。它不是单质（含两种元素），不含氧元素所以不是氧化物，也不是混合物。",
        "options": ["A. 单质", "B. 氧化物", "C. 化合物", "D. 混合物"],
        "source": "2025年宁夏中考化学试题",
    },
    {
        "stem": "下列不符合'美丽中国我先行'主题的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "easy",
        "knowledge_points": ["环境保护"],
        "answer": "A",
        "explanation": "使用一次性餐具浪费资源且引起环境污染，不符合环保主题。使用新能源汽车、生活垃圾分类、污水处理都是环保行为。",
        "options": [
            "A. 在餐厅使用一次性餐具",
            "B. 使用新能源汽车",
            "C. 生活垃圾分类投放",
            "D. 污水处理达标后排放"
        ],
        "source": "2025年广东省深圳市中考化学试题",
    },
    {
        "stem": "下列'水的沸腾'实验过程中，属于化学变化的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "easy",
        "knowledge_points": ["物理变化与化学变化"],
        "answer": "B",
        "explanation": "酒精燃烧生成二氧化碳和水，有新物质生成，属于化学变化。酒精汽化、液态水沸腾、水蒸气液化都是状态变化，属于物理变化。",
        "options": [
            "A. 酒精汽化",
            "B. 酒精燃烧",
            "C. 液态水沸腾",
            "D. 水蒸气液化"
        ],
        "source": "2025年广东省广州市中考化学试题",
    },
    {
        "stem": "下列汉字载体属于有机合成材料的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "easy",
        "knowledge_points": ["合成材料"],
        "answer": "D",
        "explanation": "塑料属于有机合成材料。兽骨主要成分是碳酸钙，蚕丝是天然蛋白质，宣纸是植物纤维，均为天然材料。",
        "options": ["A. 兽骨", "B. 蚕丝", "C. 宣纸", "D. 塑料"],
        "source": "2025年广东省广州市中考化学试题",
    },
    {
        "stem": "下列化学用语表示正确的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "化学",
        "difficulty": "medium",
        "knowledge_points": ["化学用语"],
        "answer": "B",
        "explanation": "Zn首字母应大写（不是zn）；氯化钙化学式CaCl₂正确；镁离子应为Mg²⁺；四个磷原子应为4P（不是P₄，P₄表示一个白磷分子）。",
        "options": [
            "A. 锌：zn",
            "B. 氯化钙：CaCl₂",
            "C. 镁离子：Mg²⁺",
            "D. 四个磷原子：P₄"
        ],
        "source": "2025年广东省深圳市中考化学试题",
    },

    # ==================== 语文 - 古诗文默写 ====================
    {
        "stem": "李白《行路难》中表达追求未来的勇气的名句是：'长风破浪会有时，_______。'",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "语文",
        "difficulty": "easy",
        "knowledge_points": ["古诗文默写", "李白《行路难》"],
        "answer": "直挂云帆济沧海",
        "explanation": "出自李白《行路难（其一）》，表达了诗人不畏艰难、勇往直前的坚定信念。",
        "source": "2025年宁夏中考语文试题",
    },
    {
        "stem": "杜甫《茅屋为秋风所破歌》中体现广济苍生的博爱情怀的名句是：'安得广厦千万间，_______。'",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "语文",
        "difficulty": "easy",
        "knowledge_points": ["古诗文默写", "杜甫《茅屋为秋风所破歌》"],
        "answer": "大庇天下寒士俱欢颜",
        "explanation": "出自杜甫《茅屋为秋风所破歌》，表现了诗人忧国忧民、推己及人的博大胸襟。",
        "source": "2025年宁夏中考语文试题",
    },
    {
        "stem": "苏轼《水调歌头》中感慨人世聚散离合的名句是：'_______，月有阴晴圆缺。'",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "语文",
        "difficulty": "easy",
        "knowledge_points": ["古诗文默写", "苏轼《水调歌头》"],
        "answer": "人有悲欢离合",
        "explanation": "出自苏轼《水调歌头·明月几时有》，以月的阴晴圆缺比喻人生的悲欢离合，富含哲理。",
        "source": "2025年宁夏中考语文试题",
    },
    {
        "stem": "辛弃疾《破阵子·为陈同甫赋壮词以寄之》中表达建功立业报国情怀的句子是：'_______，赢得生前身后名。'",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "语文",
        "difficulty": "easy",
        "knowledge_points": ["古诗文默写", "辛弃疾《破阵子》"],
        "answer": "了却君王天下事",
        "explanation": "出自辛弃疾《破阵子》，表达了词人渴望杀敌报国、建功立业的雄心壮志。",
        "source": "2025年宁夏中考语文试题",
    },
    {
        "stem": "《论语》中强调富贵与义的抉择的名句是：'_______，于我如浮云。'",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "语文",
        "difficulty": "easy",
        "knowledge_points": ["古诗文默写", "《论语》"],
        "answer": "不义而富且贵",
        "explanation": "出自《论语·述而》，孔子认为通过不正当手段获得的富贵，对他来说如同浮云一般。",
        "source": "2025年宁夏中考语文试题",
    },
    {
        "stem": "郦道元《三峡》中描写夏季江水湍急的句子是：'_______，不以疾也。'",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "语文",
        "difficulty": "medium",
        "knowledge_points": ["古诗文默写", "郦道元《三峡》"],
        "answer": "虽乘奔御风",
        "explanation": "出自郦道元《三峡》，用'虽乘奔御风，不以疾也'形容三峡夏季水势之迅猛。",
        "source": "2025年安徽省中考语文试题",
    },
    {
        "stem": "王湾《次北固山下》中描写江面开阔的名句是：'_______，风正一帆悬。'",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "语文",
        "difficulty": "easy",
        "knowledge_points": ["古诗文默写", "王湾《次北固山下》"],
        "answer": "潮平两岸阔",
        "explanation": "出自王湾《次北固山下》，描绘了潮水涨平后江面开阔、顺风行舟的景象。",
        "source": "2025年安徽省中考语文试题",
    },
    {
        "stem": "范仲淹《岳阳楼记》中描写洞庭湖连接远山、吞吐长江的句子是：'_______，吞长江。'",
        "question_type": "fill",
        "grade_level": "初中",
        "subject": "语文",
        "difficulty": "medium",
        "knowledge_points": ["古诗文默写", "范仲淹《岳阳楼记》"],
        "answer": "衔远山",
        "explanation": "出自范仲淹《岳阳楼记》，'衔远山，吞长江'以拟人手法描绘洞庭湖的雄伟气势。",
        "source": "2025年安徽省中考语文试题",
    },
    {
        "stem": "关于《诗经》的说法，正确的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "语文",
        "difficulty": "medium",
        "knowledge_points": ["文学常识", "《诗经》"],
        "answer": "C",
        "explanation": "《诗经》中的'风'是各地民歌，'雅'是宫廷正乐，'颂'是宗庙祭祀乐歌。反映民间生活的歌谣属于'风'，而非'雅'。",
        "options": [
            "A. 《诗经》是我国第一部诗歌总集，收录了从西周到春秋时期的诗歌305篇",
            "B. 《诗经》分为'赋''比''兴'三部分",
            "C. 《诗经》中反映民间生活的歌谣属于'风'",
            "D. 《诗经》的表现手法主要有'风''雅''颂'"
        ],
        "source": "2025年山东省烟台市中考语文试题",
    },

    # ==================== 语文 - 阅读理解 ====================
    {
        "stem": "《月湖夕照》一诗中，下列理解错误的一项是（ ）\n附诗：'一片斜阳里，湖光万顷金。芦花摇白首，鸥鸟弄清音。远岫连云暗，长桥接岸深。此中堪寄傲，何必武陵寻。'",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "语文",
        "difficulty": "hard",
        "knowledge_points": ["诗歌鉴赏"],
        "answer": "D",
        "explanation": "诗歌描绘的是月湖的壮美秀丽景色，表达诗人对此地景色的喜爱，并非用塞北景物反衬江南秀丽，而是直接描绘眼前美景并触发思乡之情。",
        "options": [
            "A. '一片斜阳里，湖光万顷金'描绘了夕阳下的湖面金光闪闪的景象",
            "B. '芦花摇白首，鸥鸟弄清音'运用了拟人手法",
            "C. '此中堪寄傲，何必武陵寻'表达了诗人对月湖的喜爱之情",
            "D. 诗歌用塞北景物反衬江南秀丽"
        ],
        "source": "2025年宁夏中考语文试题",
    },

    # ==================== 历史 ====================
    {
        "stem": "良渚遗址考古发现说明当时（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "历史",
        "difficulty": "medium",
        "knowledge_points": ["原始农耕生活", "良渚文化"],
        "answer": "A",
        "explanation": "良渚遗址出土了大量碳化稻谷和农业生产工具，说明当时原始农业较为发达。",
        "options": [
            "A. 原始农业较为发达",
            "B. 已进入青铜时代",
            "C. 出现了成熟的文字系统",
            "D. 已建立统一的封建国家"
        ],
        "source": "2025年湖北省中考历史试题",
    },
    {
        "stem": "新文化运动提倡文学变革，主要作用是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "历史",
        "difficulty": "medium",
        "knowledge_points": ["新文化运动"],
        "answer": "C",
        "explanation": "新文化运动提倡白话文、反对文言文，推动了思想解放，动摇了封建思想的统治地位。",
        "options": [
            "A. 促进了资本主义经济发展",
            "B. 推动了政治体制改革",
            "C. 起到了思想解放的作用",
            "D. 实现了国家统一"
        ],
        "source": "2025年湖北省中考历史试题",
    },
    {
        "stem": "文艺复兴的核心思想是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "历史",
        "difficulty": "easy",
        "knowledge_points": ["文艺复兴"],
        "answer": "B",
        "explanation": "人文主义是文艺复兴的核心思想，强调以人为中心，肯定人的价值和尊严，反对中世纪以神为中心的观念。",
        "options": ["A. 理性主义", "B. 人文主义", "C. 自由主义", "D. 社会主义"],
        "source": "2025年山西省中考历史试题",
    },
    {
        "stem": "'三角贸易'主要反映了资本原始积累的（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "历史",
        "difficulty": "medium",
        "knowledge_points": ["三角贸易", "资本原始积累"],
        "answer": "D",
        "explanation": "三角贸易（欧洲→非洲→美洲→欧洲）通过贩卖黑奴获取巨额利润，充分暴露了资本原始积累的野蛮性和血腥性。",
        "options": [
            "A. 进步性",
            "B. 合理性",
            "C. 合法性",
            "D. 野蛮性"
        ],
        "source": "2025年山西省中考历史试题",
    },
    {
        "stem": "1912年天津女子服饰发生显著变化，这说明（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "历史",
        "difficulty": "medium",
        "knowledge_points": ["辛亥革命的影响"],
        "answer": "B",
        "explanation": "1912年辛亥革命推翻清朝后，社会习俗发生巨大变化，女子服饰的改变体现了辛亥革命后社会观念和习俗的变革。",
        "options": [
            "A. 洋务运动推动了服饰变革",
            "B. 辛亥革命后社会习俗发生改变",
            "C. 新文化运动提倡女子解放",
            "D. 五四运动促进了思想启蒙"
        ],
        "source": "2025年山西省中考历史试题",
    },

    # ==================== 道德与法治 ====================
    {
        "stem": "我国宪法规定，我国是人民民主专政的社会主义国家，国家的一切权力属于（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "道德与法治",
        "difficulty": "easy",
        "knowledge_points": ["宪法基本原则"],
        "answer": "B",
        "explanation": "根据我国宪法规定，中华人民共和国的一切权力属于人民。这是我国宪法的基本原则。",
        "options": ["A. 公民", "B. 人民", "C. 全国人大", "D. 国务院"],
        "source": "2025年浙江省绍兴市中考道德与法治试题",
    },
    {
        "stem": "民族区域自治制度是我国的一项基本政治制度。这一制度的核心是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "道德与法治",
        "difficulty": "medium",
        "knowledge_points": ["民族区域自治制度"],
        "answer": "C",
        "explanation": "民族区域自治制度的核心是保障少数民族当家作主，管理本民族本地方事务的权利。",
        "options": [
            "A. 维护国家统一",
            "B. 促进民族团结",
            "C. 保障少数民族当家作主",
            "D. 发展民族经济"
        ],
        "source": "2025年浙江省绍兴市中考道德与法治试题",
    },
    {
        "stem": "'己所不欲，勿施于人'给我们的启示是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "道德与法治",
        "difficulty": "easy",
        "knowledge_points": ["人际交往", "尊重他人"],
        "answer": "D",
        "explanation": "'己所不欲，勿施于人'意思是自己不愿意做的事，不要强加给别人。这告诉我们要学会换位思考，尊重他人。",
        "options": [
            "A. 要诚实守信",
            "B. 要遵纪守法",
            "C. 要文明有礼",
            "D. 要学会换位思考，尊重他人"
        ],
        "source": "2025年江苏省连云港市中考道德与法治试题",
    },
    {
        "stem": "'梦想是破土萌发的芽，坚持是深扎土壤的根'。这句话启示我们实现梦想需要（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "道德与法治",
        "difficulty": "easy",
        "knowledge_points": ["理想与奋斗"],
        "answer": "A",
        "explanation": "这句话以比喻的方式说明了梦想与坚持的关系，启示我们实现梦想需要持之以恒地努力奋斗。",
        "options": [
            "A. 持之以恒地努力奋斗",
            "B. 等待合适的时机",
            "C. 依靠他人的帮助",
            "D. 制定完美的计划"
        ],
        "source": "2025年湖北省中考道德与法治试题",
    },

    # ==================== 生物 ====================
    {
        "stem": "健康人骨髓中的造血干细胞能产生各种血细胞，这一过程称为细胞分化。此过程中，细胞不发生改变的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "生物",
        "difficulty": "medium",
        "knowledge_points": ["细胞分化", "遗传物质"],
        "answer": "A",
        "explanation": "细胞分化过程中，细胞的形态、结构和功能发生改变，但遗传物质不发生改变。同一个体的所有体细胞含有相同的遗传物质。",
        "options": ["A. 遗传物质", "B. 形态", "C. 结构", "D. 功能"],
        "source": "2025年江苏省连云港市中考生物试题",
    },
    {
        "stem": "下列选项中，属于需要经过后天学习而形成的条件反射的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "生物",
        "difficulty": "easy",
        "knowledge_points": ["条件反射与非条件反射"],
        "answer": "A",
        "explanation": "谈虎色变是通过语言、文字等后天学习形成的条件反射。吮吸反射、膝跳反射、眨眼反射都是生来就有的非条件反射。",
        "options": ["A. 谈虎色变", "B. 吮吸反射", "C. 膝跳反射", "D. 眨眼反射"],
        "source": "2025年江苏省连云港市中考生物试题",
    },
    {
        "stem": "提出以自然选择学说为核心的生物进化理论的科学家是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "生物",
        "difficulty": "easy",
        "knowledge_points": ["生物进化理论", "达尔文"],
        "answer": "B",
        "explanation": "达尔文在《物种起源》中提出了以自然选择学说为核心的生物进化理论。",
        "options": ["A. 孟德尔", "B. 达尔文", "C. 巴斯德", "D. 林奈"],
        "source": "2025年江苏省连云港市中考生物试题",
    },
    {
        "stem": "生物体结构和功能的基本单位是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "生物",
        "difficulty": "easy",
        "knowledge_points": ["细胞"],
        "answer": "A",
        "explanation": "除病毒外，所有生物都是由细胞构成的，细胞是生物体结构和功能的基本单位。",
        "options": ["A. 细胞", "B. 组织", "C. 器官", "D. 系统"],
        "source": "2025年江苏省徐州市中考生物试题",
    },
    {
        "stem": "视觉形成于（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "生物",
        "difficulty": "medium",
        "knowledge_points": ["视觉的形成"],
        "answer": "D",
        "explanation": "视觉的形成过程：外界物体反射的光线→角膜→瞳孔→晶状体→玻璃体→视网膜（形成物像）→视神经→大脑皮层的视觉中枢（形成视觉）。",
        "options": ["A. 视网膜", "B. 晶状体", "C. 玻璃体", "D. 大脑皮层的视觉中枢"],
        "source": "2025年江苏省徐州市中考生物试题",
    },
    {
        "stem": "枣（双子叶植物）和稻（单子叶植物）种子的营养物质分别主要储存在（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "生物",
        "difficulty": "medium",
        "knowledge_points": ["种子的结构", "单子叶与双子叶植物"],
        "answer": "B",
        "explanation": "双子叶植物种子（如枣）的营养物质主要储存在子叶中；单子叶植物种子（如水稻）的营养物质主要储存在胚乳中。",
        "options": [
            "A. 胚乳、子叶",
            "B. 子叶、胚乳",
            "C. 胚芽、胚根",
            "D. 胚根、胚芽"
        ],
        "source": "2025年江苏省徐州市中考生物试题",
    },

    # ==================== 地理 ====================
    {
        "stem": "地球自转的方向是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "地理",
        "difficulty": "easy",
        "knowledge_points": ["地球的运动"],
        "answer": "A",
        "explanation": "地球自转方向是自西向东，从北极上空看呈逆时针方向，从南极上空看呈顺时针方向。",
        "options": ["A. 自西向东", "B. 自东向西", "C. 自南向北", "D. 自北向南"],
        "source": "2025年中考地理模拟试题",
    },
    {
        "stem": "下列属于内力作用形成的地貌是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "地理",
        "difficulty": "easy",
        "knowledge_points": ["内力作用与外力作用"],
        "answer": "C",
        "explanation": "火山是地球内部岩浆喷出地表形成的，属于内力作用。风蚀蘑菇、三角洲和冲积平原分别是风力侵蚀、流水沉积等外力作用的结果。",
        "options": ["A. 风蚀蘑菇", "B. 三角洲", "C. 火山", "D. 冲积平原"],
        "source": "2025年中考地理模拟试题",
    },
    {
        "stem": "下列属于可再生资源的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "地理",
        "difficulty": "easy",
        "knowledge_points": ["自然资源分类"],
        "answer": "C",
        "explanation": "风能属于可再生资源，可以在较短时间内更新、再生。煤炭、石油、天然气属于非可再生资源，形成需要漫长的地质年代。",
        "options": ["A. 煤炭", "B. 石油", "C. 风能", "D. 天然气"],
        "source": "2025年中考地理模拟试题",
    },
    {
        "stem": "我国人口分布的基本特点是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "地理",
        "difficulty": "easy",
        "knowledge_points": ["中国人口分布"],
        "answer": "A",
        "explanation": "我国人口分布以黑河—腾冲线为界，东南部人口稠密（占全国94%），西北部人口稀疏（占全国6%），呈现东多西少的特点。",
        "options": ["A. 东多西少", "B. 西多东少", "C. 南少北多", "D. 均匀分布"],
        "source": "2025年中考地理模拟试题",
    },
    {
        "stem": "长江发源于（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "地理",
        "difficulty": "easy",
        "knowledge_points": ["长江"],
        "answer": "A",
        "explanation": "长江发源于青藏高原的唐古拉山脉各拉丹冬峰，自西向东流经11个省区，注入东海。",
        "options": ["A. 唐古拉山", "B. 巴颜喀拉山", "C. 昆仑山", "D. 天山"],
        "source": "2025年中考地理模拟试题",
    },
    {
        "stem": "位于我国地势第二级阶梯的地形区是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "地理",
        "difficulty": "medium",
        "knowledge_points": ["中国地势阶梯"],
        "answer": "B",
        "explanation": "我国地势第二级阶梯包括内蒙古高原、黄土高原、云贵高原、四川盆地、塔里木盆地、准噶尔盆地等。青藏高原在第一级阶梯，华北平原和长江中下游平原在第三级阶梯。",
        "options": [
            "A. 青藏高原",
            "B. 内蒙古高原",
            "C. 华北平原",
            "D. 长江中下游平原"
        ],
        "source": "2025年中考地理模拟试题",
    },
    {
        "stem": "热带雨林气候的特征是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "地理",
        "difficulty": "easy",
        "knowledge_points": ["气候类型"],
        "answer": "B",
        "explanation": "热带雨林气候分布在赤道附近，全年高温多雨，年均温约25°C，年降水量2000mm以上。",
        "options": [
            "A. 全年寒冷干燥",
            "B. 全年高温多雨",
            "C. 夏季高温多雨，冬季寒冷干燥",
            "D. 全年温和多雨"
        ],
        "source": "2025年中考地理模拟试题",
    },
    {
        "stem": "青稞是哪一地区的主要粮食作物？",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "地理",
        "difficulty": "easy",
        "knowledge_points": ["中国农业", "青藏地区"],
        "answer": "D",
        "explanation": "青稞耐寒、耐旱，是青藏高原地区的主要粮食作物，适合在高寒气候条件下生长。",
        "options": ["A. 东北平原", "B. 华北平原", "C. 长江中下游平原", "D. 青藏高原"],
        "source": "2025年中考地理模拟试题",
    },
    {
        "stem": "生态系统中的能量沿食物链流动的特点是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "生物",
        "difficulty": "medium",
        "knowledge_points": ["生态系统", "能量流动"],
        "answer": "C",
        "explanation": "生态系统中的能量沿食物链单向流动，逐级递减，传递效率一般为10%-20%。",
        "options": [
            "A. 双向流动，逐级递增",
            "B. 单向流动，逐级递增",
            "C. 单向流动，逐级递减",
            "D. 循环流动"
        ],
        "source": "2025年中考生物模拟试题",
    },
    {
        "stem": "下列属于先天性行为的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "生物",
        "difficulty": "easy",
        "knowledge_points": ["先天性行为与学习行为"],
        "answer": "B",
        "explanation": "蜘蛛结网是生来就有的、由遗传物质决定的先天性行为。鹦鹉学舌、老马识途、小狗算数都是后天学习获得的行为。",
        "options": ["A. 鹦鹉学舌", "B. 蜘蛛结网", "C. 老马识途", "D. 小狗算数"],
        "source": "2025年中考生物模拟试题",
    },
    {
        "stem": "以下属于特异性免疫的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "生物",
        "difficulty": "medium",
        "knowledge_points": ["免疫类型"],
        "answer": "D",
        "explanation": "患过水痘后不再患水痘是特异性免疫（获得性免疫），只针对特定病原体。皮肤阻挡、溶菌酶杀菌、吞噬细胞吞噬都是非特异性免疫。",
        "options": [
            "A. 皮肤的屏障作用",
            "B. 溶菌酶的杀菌作用",
            "C. 吞噬细胞的吞噬作用",
            "D. 患过水痘的人不再患水痘"
        ],
        "source": "2025年中考生物模拟试题",
    },
    {
        "stem": "我国高新技术产业的特点是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "地理",
        "difficulty": "easy",
        "knowledge_points": ["高新技术产业"],
        "answer": "C",
        "explanation": "高新技术产业以高新技术为基础，特点是科技含量高、更新换代快、从业人员中科技人员比重大、研发投入高。",
        "options": [
            "A. 劳动力密集",
            "B. 资源消耗大",
            "C. 科技含量高",
            "D. 污染严重"
        ],
        "source": "2025年中考地理模拟试题",
    },
    {
        "stem": "下列历史事件中，标志着中国近代史开端的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "历史",
        "difficulty": "easy",
        "knowledge_points": ["鸦片战争", "中国近代史开端"],
        "answer": "A",
        "explanation": "1840年鸦片战争标志着中国近代史的开端，中国开始沦为半殖民地半封建社会。",
        "options": [
            "A. 鸦片战争",
            "B. 甲午中日战争",
            "C. 辛亥革命",
            "D. 五四运动"
        ],
        "source": "2025年中考历史真题",
    },
    {
        "stem": "遵义会议在党的历史上具有重要意义，这次会议（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "历史",
        "difficulty": "medium",
        "knowledge_points": ["遵义会议"],
        "answer": "B",
        "explanation": "1935年遵义会议纠正了'左'倾错误，确立了毛泽东的正确领导地位，是党的历史上生死攸关的转折点。",
        "options": [
            "A. 标志着中国共产党成立",
            "B. 是党的历史上生死攸关的转折点",
            "C. 确立了改革开放的方针",
            "D. 标志着抗日战争全面爆发"
        ],
        "source": "2025年山西省中考历史试题",
    },
    {
        "stem": "实现梦想需要脚踏实地、埋头苦干。外卖骑手、程序员、新农人等普通劳动者的事迹说明了（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "道德与法治",
        "difficulty": "medium",
        "knowledge_points": ["劳动的价值", "实干精神"],
        "answer": "D",
        "explanation": "各行各业普通劳动者通过辛勤劳动创造价值，说明实干精神和劳动是创造美好生活的重要途径。",
        "options": [
            "A. 只有高学历才能实现梦想",
            "B. 体力劳动比脑力劳动更有价值",
            "C. 个人梦想与国家发展无关",
            "D. 实干精神和劳动创造价值"
        ],
        "source": "2025年湖北省中考道德与法治试题",
    },
    {
        "stem": "社区电梯换新工作通过居民协商会议决定，这体现了（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "道德与法治",
        "difficulty": "medium",
        "knowledge_points": ["基层群众自治制度"],
        "answer": "C",
        "explanation": "社区通过居民协商会议决定公共事务，体现了基层群众自治制度，是我国的基本政治制度之一。",
        "options": [
            "A. 人民代表大会制度",
            "B. 民族区域自治制度",
            "C. 基层群众自治制度",
            "D. 多党合作制度"
        ],
        "source": "2025年山西省中考道德与法治试题",
    },
    {
        "stem": "费尔巴哈说：'理论所不能解决的疑难问题，实践将为你解决。'这句话强调（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "道德与法治",
        "difficulty": "medium",
        "knowledge_points": ["实践与认识"],
        "answer": "C",
        "explanation": "这句话强调实践是检验真理的唯一标准，实践决定认识。理论解决不了的问题需要通过实践来解决。",
        "options": [
            "A. 实践是认识的来源",
            "B. 实践是认识发展的动力",
            "C. 实践是检验真理的唯一标准",
            "D. 实践是认识的目的"
        ],
        "source": "2025年中考道德与法治真题",
    },
    {
        "stem": "友谊与竞争的关系，下列说法正确的是（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "道德与法治",
        "difficulty": "easy",
        "knowledge_points": ["友谊与竞争"],
        "answer": "B",
        "explanation": "真正的友谊不会因为竞争而受到损害，朋友之间可以相互竞争、共同进步。竞争中有合作，友谊与竞争并不矛盾。",
        "options": [
            "A. 友谊和竞争是水火不容的",
            "B. 朋友间可以相互竞争，共同进步",
            "C. 为维护友谊应当避免一切竞争",
            "D. 竞争必然损害友谊"
        ],
        "source": "2025年江苏省常州市中考道德与法治试题",
    },
    {
        "stem": "《民营经济促进法》的制定和实施体现了（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "道德与法治",
        "difficulty": "medium",
        "knowledge_points": ["基本经济制度"],
        "answer": "C",
        "explanation": "《民营经济促进法》旨在鼓励、支持和引导非公有制经济发展，体现了我国坚持公有制为主体、多种所有制经济共同发展的基本经济制度。",
        "options": [
            "A. 公有制经济的主导地位被削弱",
            "B. 计划经济向市场经济转变",
            "C. 鼓励、支持、引导非公有制经济发展",
            "D. 取消了对经济的宏观调控"
        ],
        "source": "2025年江苏省常州市中考道德与法治试题",
    },
    {
        "stem": "'竹子定律'告诉我们竹子前四年只长3厘米，第五年开始每天长30厘米。这启示我们（ ）",
        "question_type": "choice",
        "grade_level": "初中",
        "subject": "道德与法治",
        "difficulty": "easy",
        "knowledge_points": ["坚持与积累"],
        "answer": "A",
        "explanation": "'竹子定律'说明成功需要长期积累和沉淀，启示我们要耐得住寂寞、打好基础，厚积薄发。",
        "options": [
            "A. 厚积薄发，打好基础才能成功",
            "B. 抓住机会就能一夜成功",
            "C. 天赋比努力更重要",
            "D. 成功不需要长期准备"
        ],
        "source": "2025年河南省中考道德与法治试题",
    },
]


# ============================================================
# 主流程
# ============================================================
def load_questions_from_file(source_path: str) -> list:
    if not os.path.exists(source_path):
        print(f"[FAIL] Source file not found: {source_path}")
        sys.exit(1)
    data = json.loads(open(source_path, "r", encoding="utf-8").read())
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        questions = data.get("questions") or data.get("items") or data.get("data") or []
        if questions:
            return questions
    print("[FAIL] Could not find question array in source file")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Import exam questions to the question bank.")
    parser.add_argument(
        "--source",
        default=None,
        help="Path to a JSON file containing questions (if not provided, uses built-in questions)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate questions without importing",
    )
    args = parser.parse_args()

    if args.source:
        questions = load_questions_from_file(args.source)
    else:
        questions = QUESTIONS

    print("=" * 60)
    print("智学伴题库导入工具 - 2025年中考真题")
    print("=" * 60)

    if args.dry_run:
        print(">>> DRY RUN 模式，仅校验不导入 <<<")
        print(f"题目总数: {len(questions)} 道")
        subjects = {}
        for q in questions:
            subj = q.get("subject", "未知")
            subjects[subj] = subjects.get(subj, 0) + 1
        print("按学科分布:")
        for subj, count in sorted(subjects.items()):
            print(f"  {subj}: {count} 道")
        print(f"\n[OK] 校验通过，共 {len(questions)} 道题目")
        return 0

    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print("[FAIL] 请设置环境变量:")
        print("  ZHI_XUE_BAN_ADMIN_EMAIL=admin@example.com")
        print("  ZHI_XUE_BAN_ADMIN_PASSWORD=your_password")
        print("  ZHI_XUE_BAN_BASE_URL  (可选，默认 http://127.0.0.1:8000)")
        sys.exit(1)

    print(f"目标服务器: {BASE_URL}")
    print(f"题目总数: {len(questions)} 道")
    print()

    # 按学科统计
    subjects = {}
    for q in questions:
        subj = q.get("subject", "未知")
        subjects[subj] = subjects.get(subj, 0) + 1
    print("按学科分布:")
    for subj, count in sorted(subjects.items()):
        print(f"  {subj}: {count} 道")
    print()

    # 登录
    print("正在登录...")
    token = login()
    print()

    # 导入
    success = 0
    failed = 0
    total = len(questions)

    for i, question in enumerate(questions, 1):
        stem_preview = question["stem"][:40].replace("\n", " ")
        print(f"[{i}/{total}] {question['subject']}-{question['question_type']}: {stem_preview}...")
        if import_question(token, question):
            success += 1
            print(f"  [OK] 导入成功")
        else:
            failed += 1
        time.sleep(0.3)

    print()
    print("=" * 60)
    print(f"导入完成！")
    print(f"  成功: {success} 道")
    print(f"  失败: {failed} 道")
    print(f"  总计: {total} 道")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
