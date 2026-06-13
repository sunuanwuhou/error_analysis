"""公务员结构化面试题库种子数据。"""

from __future__ import annotations

import secrets
from typing import Any

from backend.database import get_conn
from backend.security import utcnow

SEED_QUESTIONS: list[dict[str, Any]] = [
    # ── 综合分析 (10) ──
    {
        "id": "iv-q-comp-01",
        "category": "comprehensive",
        "difficulty": 2,
        "source": "国考经典题",
        "question_text": "有人说「基层工作就是重复劳动，没有成长空间」，你怎么看？",
        "framework": "1. 表态：不认同该观点，需辩证看待\n2. 分析基层价值：贴近群众、锻炼综合能力\n3. 分析成长路径：在平凡中积累、在解决难题中提升\n4. 结合自身：若有基层经历可举例；若无则谈态度与规划\n5. 总结：基层是成长的沃土",
        "sample_answer": "基层工作看似重复，实则是在服务群众中锤炼沟通、协调、应急等能力。许多优秀干部都是从基层一线成长起来的。我会把重复当作熟练与沉淀，在解决群众急难愁盼中实现个人价值。",
    },
    {
        "id": "iv-q-comp-02",
        "category": "comprehensive",
        "difficulty": 2,
        "source": "省考真题",
        "question_text": "当前部分年轻人出现「躺平」心态，对此你怎么看？",
        "framework": "1. 客观认识：社会压力、就业竞争等客观因素\n2. 辩证分析：不能简单标签化，要看到多元选择\n3. 政府作为：完善就业、住房、社会保障\n4. 青年责任：在时代机遇中主动作为\n5. 总结升华",
        "sample_answer": "「躺平」反映部分青年在高压下的消极应对，需社会各方共同关注。政府应营造公平环境、拓宽发展通道；青年也应树立正确价值观，在奋斗中实现人生价值。",
    },
    {
        "id": "iv-q-comp-03",
        "category": "comprehensive",
        "difficulty": 3,
        "source": "国考真题",
        "question_text": "「数字政务」提高了效率，但也有群众反映「不会用、用不好」，你怎么看？",
        "framework": "1. 肯定数字政务成效\n2. 正视「数字鸿沟」问题\n3. 原因：年龄、教育、设计不友好\n4. 对策：保留线下渠道、优化界面、开展培训、人工辅助\n5. 总结",
        "sample_answer": "数字政务是方向，但服务不能只对「会用的人」友好。应坚持线上线下并重，保留传统办事窗口，并对老年群体等提供帮办代办，让技术真正惠及所有人。",
    },
    {
        "id": "iv-q-comp-04",
        "category": "comprehensive",
        "difficulty": 2,
        "source": "省考真题",
        "question_text": "有人说公务员要「稳」，有人说要「创新」，你怎么看？",
        "framework": "1. 二者并不矛盾\n2. 「稳」：依法办事、政策连续、风险可控\n3. 「创新」：流程优化、服务提升、治理现代化\n4. 结合岗位谈平衡\n5. 总结",
        "sample_answer": "稳是底线，创新是动力。公务员应在遵守法律法规和政策框架的前提下，主动优化服务流程、运用新技术提升效能，做到守正创新。",
    },
    {
        "id": "iv-q-comp-05",
        "category": "comprehensive",
        "difficulty": 2,
        "source": "经典题",
        "question_text": "「功成不必在我，功成必定有我」，谈谈你的理解。",
        "framework": "1. 解释含义：不计较个人名利，但要有担当\n2. 体现政绩观：久久为功、接续奋斗\n3. 举例：基础设施建设、生态治理等\n4. 联系自身：立足岗位踏实做事\n5. 总结",
        "sample_answer": "这句话强调正确的政绩观和奉献精神。许多工作周期长、见效慢，需要一任接着一任干。我会不计个人得失，把本职工作做好，为长远发展贡献力量。",
    },
    {
        "id": "iv-q-comp-06",
        "category": "comprehensive",
        "difficulty": 3,
        "source": "省考真题",
        "question_text": "某地推广「夜经济」，但出现噪音扰民问题，你怎么看？",
        "framework": "1. 肯定夜经济对消费、就业的意义\n2. 指出扰民问题的危害\n3. 原因：规划不足、监管缺位\n4. 对策：合理布局、限时经营、加强执法、群众沟通\n5. 总结",
        "sample_answer": "发展夜经济与保障居民休息权要统筹兼顾。应科学划定经营区域和时间，加强联合执法，建立投诉快速响应机制，实现经济发展与民生保障双赢。",
    },
    {
        "id": "iv-q-comp-07",
        "category": "comprehensive",
        "difficulty": 2,
        "source": "经典题",
        "question_text": "「上面千条线，下面一根针」，谈谈你对基层工作的认识。",
        "framework": "1. 解释比喻：上级政策最终靠基层落实\n2. 基层特点：任务多、资源少、直面群众\n3. 难点：形式主义、考核过多等\n4. 如何支持基层：减负、赋能、关爱\n5. 自身态度",
        "sample_answer": "基层是治理体系的「最后一公里」。我会尊重基层实际，提升执行力和群众工作能力，同时希望上级在部署任务时考虑基层承受能力，切实为基层减负。",
    },
    {
        "id": "iv-q-comp-08",
        "category": "comprehensive",
        "difficulty": 2,
        "source": "国考真题",
        "question_text": "如何看待「指尖上的形式主义」？",
        "framework": "1. 定义：过度依赖 APP、群打卡、留痕\n2. 危害：浪费精力、脱离实际\n3. 原因：考核导向偏差\n4. 治理：精简整合、以实效论英雄\n5. 总结",
        "sample_answer": "「指尖上的形式主义」让干部忙于应付软件而非服务群众。应整合政务应用、减少重复填报，考核注重实际成效和群众满意度，把精力还给一线。",
    },
    {
        "id": "iv-q-comp-09",
        "category": "comprehensive",
        "difficulty": 3,
        "source": "省考真题",
        "question_text": "「新质生产力」成为热词，请谈谈你的理解。",
        "framework": "1. 概念：创新主导、高科技高效能高质量\n2. 意义：推动高质量发展\n3. 政府角色：政策引导、营商环境、人才培育\n4. 结合本地/行业（可略谈）\n5. 总结",
        "sample_answer": "新质生产力强调以科技创新推动产业升级。政府应营造创新生态，保护知识产权，支持企业数字化转型，同时注重传统产业升级，因地制宜发展新质生产力。",
    },
    {
        "id": "iv-q-comp-10",
        "category": "comprehensive",
        "difficulty": 2,
        "source": "经典题",
        "question_text": "「民之所忧，我必念之；民之所盼，我必行之」，谈谈你的理解。",
        "framework": "1. 体现以人民为中心\n2. 具体内涵：关注急难愁盼\n3. 实践要求：深入调研、办好实事\n4. 结合岗位\n5. 总结",
        "sample_answer": "这句话要求始终把群众利益放在首位。我会主动走访、倾听诉求，把政策落实到解决具体问题上，用实实在在的工作换取群众认可。",
    },
    # ── 计划组织协调 (8) ──
    {
        "id": "iv-q-plan-01",
        "category": "planning",
        "difficulty": 2,
        "source": "经典题",
        "question_text": "单位要组织一次「政务服务开放日」活动，领导让你负责，你怎么组织？",
        "framework": "1. 明确目标与参与对象\n2. 前期：方案、场地、邀请代表、宣传\n3. 中期：流程（参观、体验、座谈）、人员分工、应急预案\n4. 后期：收集反馈、媒体报道、总结报告\n5. 注意：安全、秩序、实效",
        "sample_answer": "我会先拟定方案报领导审定，邀请群众代表、企业代表参加；设置办事体验、政策宣讲、现场答疑等环节；活动后整理意见建议纳入改进清单，形成闭环。",
    },
    {
        "id": "iv-q-plan-02",
        "category": "planning",
        "difficulty": 2,
        "source": "省考真题",
        "question_text": "社区要开展老年人防诈骗宣传，领导交给你，你怎么做？",
        "framework": "1. 调研：高发诈骗类型、老人接受习惯\n2. 内容：案例、识别技巧、报警渠道\n3. 形式：讲座、入户、微信群、横幅\n4. 联合：公安、银行、志愿者\n5. 评估：覆盖人数、反馈、后续跟进",
        "sample_answer": "我会联合派出所梳理典型案例，采用「大课堂+小网格」方式，用方言和通俗语言讲解；对独居老人上门提醒；建立社区举报咨询渠道，持续更新骗术预警。",
    },
    {
        "id": "iv-q-plan-03",
        "category": "planning",
        "difficulty": 3,
        "source": "国考真题",
        "question_text": "上级要来检查你们单位的保密工作，领导让你准备，你怎么做？",
        "framework": "1. 研读检查标准与重点\n2. 自查：制度、台账、设备、人员培训\n3. 整改：发现问题立即完善\n4. 迎检：资料整理、路线安排、汇报材料\n5. 长效机制：巩固成果",
        "sample_answer": "我会对照检查清单逐项自查，重点核查涉密文件管理、计算机使用和培训记录；对短板限期整改；迎检时如实汇报，检查后继续完善保密制度并开展全员教育。",
    },
    {
        "id": "iv-q-plan-04",
        "category": "planning",
        "difficulty": 2,
        "source": "经典题",
        "question_text": "单位要组织青年干部学习交流会，领导让你负责，你怎么安排？",
        "framework": "1. 确定主题与形式\n2. 征集发言人选与材料\n3. 场地、设备、议程、主持\n4. 邀请领导总结\n5. 整理成果、建立学习档案",
        "sample_answer": "我会围绕当前重点工作和青年成长需求确定主题，采用「主题演讲+互动讨论」形式，提前收集案例；会后汇编优秀发言，推动学习成果转化。",
    },
    {
        "id": "iv-q-plan-05",
        "category": "planning",
        "difficulty": 2,
        "source": "省考真题",
        "question_text": "你是驻村第一书记，村里要发展特色种植产业，你会怎么推进？",
        "framework": "1. 调研：土壤、市场、村民意愿\n2. 规划：品种选择、规模、合作模式\n3. 实施：培训、资金、技术对接、示范户\n4. 销售：品牌、渠道、电商\n5. 风险：自然灾害、市场波动",
        "sample_answer": "我会先入户了解意愿和能力，邀请农技专家评估；选择适合品种，培育合作社；对接帮扶资金和技术；打通销售渠道，建立保底收购机制，让村民看到实惠。",
    },
    {
        "id": "iv-q-plan-06",
        "category": "planning",
        "difficulty": 3,
        "source": "经典题",
        "question_text": "单位要举办大型政策宣讲会，预计300人参加，你如何组织？",
        "framework": "1. 确定时间地点、报名渠道\n2. 议程：领导致辞、专家解读、答疑\n3. 会务：签到、资料、音响、直播\n4. 安全：消防、医疗、秩序维护\n5. 宣传与总结",
        "sample_answer": "我会提前发布通知并控制人数，布置会场和直播设备；准备简明政策解读材料；协调安保和医疗；现场收集问题会后书面答复；通过官网发布宣讲实录扩大覆盖面。",
    },
    {
        "id": "iv-q-plan-07",
        "category": "planning",
        "difficulty": 2,
        "source": "省考真题",
        "question_text": "要开展一次「文明餐桌」主题宣传活动，你怎么组织？",
        "framework": "1. 明确目标：厉行节约、反对浪费\n2. 对象：餐饮单位、学校、机关食堂\n3. 活动：倡议、监督检查、典型宣传\n4. 持续：长效机制、红黑榜\n5. 总结",
        "sample_answer": "我会联合市场监管等部门向餐饮单位发放倡议并张贴标识；组织志愿者劝导；曝光浪费典型案例、宣传节约先进；推动「光盘行动」纳入日常管理。",
    },
    {
        "id": "iv-q-plan-08",
        "category": "planning",
        "difficulty": 2,
        "source": "经典题",
        "question_text": "领导让你组织一次同事间的业务技能比武，你怎么策划？",
        "framework": "1. 确定比武项目与规则\n2. 动员报名、分组抽签\n3. 评委、场地、计时评分\n4. 颁奖与经验分享\n5. 形成常态练兵机制",
        "sample_answer": "我会围绕核心业务设计实操题目，邀请业务骨干和外部专家担任评委；确保规则公开透明；赛后组织冠军分享经验，将优秀做法写入业务指南。",
    },
    # ── 人际沟通 (7) ──
    {
        "id": "iv-q-inter-01",
        "category": "interpersonal",
        "difficulty": 2,
        "source": "经典题",
        "question_text": "你刚入职，老同事把繁琐工作都推给你，你怎么办？",
        "framework": "1. 态度：虚心学习但不无限接受\n2. 沟通：了解分工惯例，表达自身负荷\n3. 行动：完成本职，必要时请领导协调\n4. 关系：尊重老同事，主动请教\n5. 总结",
        "sample_answer": "我会先认真完成交办任务，同时通过沟通了解合理分工；若长期影响本职，会委婉说明并向领导汇报寻求协调；平时多向老同事学习，建立良好合作关系。",
    },
    {
        "id": "iv-q-inter-02",
        "category": "interpersonal",
        "difficulty": 2,
        "source": "省考真题",
        "question_text": "你和同事共同完成一项任务，领导只表扬了你，同事对你有意见，你怎么办？",
        "framework": "1. 反思：是否自己沟通不足\n2. 主动：向同事说明功劳共有\n3. 补救：向领导澄清团队贡献\n4. 今后：多强调团队、共享信息\n5. 总结",
        "sample_answer": "我会主动找同事沟通，肯定他的付出；在合适场合向领导说明这是团队合作成果；今后工作中多分享进展，避免再出现误解。",
    },
    {
        "id": "iv-q-inter-03",
        "category": "interpersonal",
        "difficulty": 3,
        "source": "国考真题",
        "question_text": "群众来办事不符合政策，情绪激动，你怎么办？",
        "framework": "1. 稳定情绪：请坐、倒水、耐心倾听\n2. 解释政策：通俗易懂、依据充分\n3. 帮助：告知合法途径或替代方案\n4. 若仍不满：请示领导、记录诉求\n5. 总结反思",
        "sample_answer": "我会先安抚情绪，耐心听完诉求；用政策和实例解释为何不能办理；积极帮助寻找合规解决办法；若涉及特殊困难，及时汇报领导研究处理。",
    },
    {
        "id": "iv-q-inter-04",
        "category": "interpersonal",
        "difficulty": 2,
        "source": "经典题",
        "question_text": "领导安排的工作与你的专业不对口，你怎么办？",
        "framework": "1. 服从安排\n2. 快速学习补齐短板\n3. 请教同事和领导\n4. 保质保量完成\n5. 把挑战当成长机会",
        "sample_answer": "组织需要应无条件服从。我会查阅资料、向同事请教，制定学习计划，确保按时保质完成；同时把这次经历作为拓展能力的宝贵机会。",
    },
    {
        "id": "iv-q-inter-05",
        "category": "interpersonal",
        "difficulty": 2,
        "source": "省考真题",
        "question_text": "两位同事因工作方法不同产生矛盾，影响进度，你怎么办？",
        "framework": "1. 了解双方诉求\n2. 分别沟通、求同存异\n3. 聚焦任务目标\n4. 必要时汇报领导协调\n5. 后续跟进",
        "sample_answer": "我会分别听取意见，引导双方就任务目标达成一致；建议各取所长、明确分工节点；若仍无法调和，及时向领导汇报，避免影响整体工作。",
    },
    {
        "id": "iv-q-inter-06",
        "category": "interpersonal",
        "difficulty": 3,
        "source": "经典题",
        "question_text": "你发现同事在工作中违反规定，但他是你的好友，你怎么办？",
        "framework": "1. 原则：纪律面前无例外\n2. 先私下提醒同事\n3. 若不改正：按程序报告\n4. 注意方式方法\n5. 总结",
        "sample_answer": "我会私下严肃提醒好友，说明危害和后果；若仍不改正，必须向组织报告，这是对工作和同事负责；事后也会帮助其改正错误、恢复信任。",
    },
    {
        "id": "iv-q-inter-07",
        "category": "interpersonal",
        "difficulty": 2,
        "source": "省考真题",
        "question_text": "你提出的合理建议被领导否决，你怎么办？",
        "framework": "1. 尊重领导决定\n2. 反思建议是否周全\n3. 可择机补充说明\n4. 执行决定不打折扣\n5. 继续积极建言",
        "sample_answer": "领导站得更高、信息更全，我会先执行决定；反思建议是否在可行性、成本等方面考虑不周；若仍有价值，可择机在汇报中补充数据；今后继续立足岗位积极献策。",
    },
]


def seed_interview_questions_if_empty() -> int:
    """若题库为空则写入种子题目，返回本次插入条数。"""
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*)::int AS c FROM interview_questions").fetchone()
        if int(row["c"] if row else 0) > 0:
            return 0
        now = utcnow().isoformat()
        inserted = 0
        for q in SEED_QUESTIONS:
            conn.execute(
                """
                INSERT INTO interview_questions (
                  id, category, difficulty, question_text, framework, sample_answer, source, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    q["id"],
                    q["category"],
                    int(q.get("difficulty") or 2),
                    q["question_text"],
                    q.get("framework") or "",
                    q.get("sample_answer") or "",
                    q.get("source") or "",
                    now,
                ),
            )
            inserted += 1
        conn.commit()
        return inserted


def new_record_id() -> str:
    return "iv-rec-" + secrets.token_hex(8)
