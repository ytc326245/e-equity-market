(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.EquityTutorial=value;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const references=[
    {id:'basics',name:'Investor.gov · 投资入门与股价影响因素',url:'https://www.investor.gov/introduction-investing'},
    {id:'pe',name:'Investor.gov · 市盈率定义',url:'https://www.investor.gov/introduction-investing/investing-basics/glossary/price-earnings-pe-ratio'},
    {id:'edgar',name:'SEC · 公司公告检索',url:'https://www.sec.gov/edgar/search/'},
    {id:'apple',name:'Apple · 2026 财年第四季度公告',url:'https://www.apple.com/newsroom/2026/11/apple-reports-fourth-quarter-results/'},
    {id:'microsoft',name:'Microsoft · 2027 财年第一季度公告',url:'https://www.microsoft.com/en-us/Investor/earnings/FY-2027-Q1/press-release-webcast'},
    {id:'intel',name:'Intel · 2026 年第三季度公告（SEC）',url:'https://www.sec.gov/Archives/edgar/data/50863/000005086326000188/q326earningsrelease.htm'},
    ...['AAPL','MSFT','INTC'].map(s=>({id:'yahoo-'+s,name:`Yahoo Finance · ${s} 指标来源`,url:`https://finance.yahoo.com/quote/${s}/key-statistics/`}))
  ];
  const lessons=[
    {id:'quotes',title:'股价、涨跌、成交量',subtitle:'先看懂行情页的三个数字',minutes:3,terms:'价格 昨收 涨跌幅 成交量 分时图 买价 卖价 52周',blocks:[
      ['一股多少钱，不等于整家公司值多少钱','股价是一股证券最近成交的价格。像买一片蛋糕，单片价格不能直接告诉你整块蛋糕的大小。比较公司大小要看市值，还要区分普通股、存托凭证和 ETF。'],
      ['涨跌是跟谁比？','涨跌额 = 当前来源价格 − 昨日收盘价。涨跌幅 = 涨跌额 ÷ 昨收 × 100%。例如昨收 100 美元、现价 102 美元，就是上涨 2 美元、2%。分时线从早盘涨到尾盘，仍可能低于昨收，因此当天涨跌幅也可能为负。'],
      ['成交量是交易活跃度，不是“有多少人买入”','一笔成交同时有买方和卖方。成交量通常统计交易股数，不能把放量直接翻译成“买的人比卖的人多”或“一定要涨”。它要和价格变化、消息及交易时段一起观察。'],
      ['图表中的一个点，未必是这一分钟的最高或最低','本程序分时图使用 Nasdaq 采样，历史图使用来源日收盘。采样点可能漏掉开收盘竞价和日内极值。纽约时间、正常交易时段、盘前盘后和不同来源的覆盖范围都会影响对照结果。'],
      ['去哪里找','本程序价格、涨跌和成交量来自 Nasdaq 公开接口。查看报价日期和软件读取时间：刚读取，不代表上游价格没有延迟。成交量采用来源口径；“—”表示缺失，不是零。']
    ],question:{text:'一只股票早盘 95 美元、尾盘 98 美元，昨收 100 美元。下列哪项正确？',options:['尾盘比早盘高，所以当天一定上涨','分时向上，但相对昨收仍下跌 2%','只要成交量增加就会涨回 100'],answer:1,explain:'分时起点与昨收不是同一个比较对象。98 相对昨收 100 下跌 2%。'}},
    {id:'account',title:'看懂自己的虚拟账户',subtitle:'把单价、股数、资产与盈亏分开',minutes:2,terms:'本金 可用资金 总资产 持仓市值 平均成本 浮动盈亏 已实现 盈亏',blocks:[
      ['四个数字放在一起看','本金是本轮投入的虚拟资金；可用资金是尚未买入股票的现金；持仓市值是持有股数 × 当前来源报价；总资产是可用资金加持仓市值。缺少部分持仓报价时，本程序不会猜测总资产。'],
      ['涨了，但还没卖：浮动盈亏','假设花 100 美元买入一股，现在报价 110 美元，浮动盈利约 10 美元；卖出后，相关盈亏才转为已实现。平均成本是分配到每股的购入成本，不是未来股价的目标。'],
      ['累计盈亏与已实现盈亏为什么不同','本程序累计盈亏 = 估算总资产 − 初始本金，同时包含现金与持仓变化；已实现盈亏只汇总已经卖出部分的成交收入与对应成本之差。两者不能互相替代。'],
      ['模拟结果的来源与边界','成交记录和现金来自本设备账户账本，持仓估值来自公开报价。本程序没有模拟分红入账、拆股、手续费、滑点和部分成交，长期结果不能直接当作真实券商收益。教程练习不会替你下单或重设本金。']
    ],question:{text:'买入后价格上涨，但还没有卖出，这一部分属于什么？',options:['已经到账的现金收益','浮动盈亏','公司给你的股息'],answer:1,explain:'持仓价值随报价变化；卖出之前的价格盈亏是浮动的，也可能再次回落。'}},
    {id:'earnings',title:'EPS：公司赚了多少钱',subtitle:'每股盈利与统计期间要一起读',minutes:3,terms:'EPS 每股收益 每股盈利 TTM 滚动 财报 季度 GAAP ADR 存托凭证',blocks:[
      ['先问公司靠什么赚钱','先用自己的话说清楚公司卖什么、谁来付钱、收入能否持续。营业收入是卖货或提供服务获得的收入；利润还要扣除相关成本和费用。收入增长不必然等于利润增长。'],
      ['EPS 是把利润分摊到每股','EPS 是每股盈利，用于描述每股对应的盈利能力。简化理解为归属于股东的利润 ÷ 加权平均股数；稀释 EPS 还考虑可能增加的股份。它不是每股股息，也不是你账户里收到的钱。'],
      ['TTM 是过去 12 个月，不是未来一年','本程序展示 Yahoo 的滚动 EPS。季度 EPS 只覆盖一个季度；年报 EPS 覆盖一个财年。公司可能有淡旺季，不能看到一个好季度就直接乘 4 当成全年实际盈利。财年也不一定从 1 月开始。'],
      ['同样写 EPS，为什么数值不同','先查基本/稀释、GAAP/调整后、季度/TTM，以及币种和每股单位。GAAP 是按通用会计准则报告的口径；调整后数值可能剔除特定项目，具体看公告说明。一次性收益、损失、回购和新股发行也可能改变 EPS。存托凭证是境外公司在美国上市使用的一种证券，可代表一定比例的普通股。中概股的每份存托凭证与本土普通股可能不一一对应，不能直接混比。'],
      ['从哪里来，接下来查什么','公司公告、年报或季报披露原始利润和股数；Yahoo 等平台整理成滚动指标。本程序转述来源口径并标日期。继续查利润是否来自主营业务、现金流是否支持利润，而不是只看 EPS 大小。']
    ],refs:['edgar'],question:{text:'公告里的季度 EPS 与行情页 TTM EPS 不一样，第一步应该做什么？',options:['认定其中一个平台造假','先检查期间、调整口径和币种','把季度 EPS 自动乘 4'],answer:1,explain:'统计期间和口径不同可以造成正常差异。TTM 也不是对未来的盈利承诺。'}},
    {id:'valuation',title:'PE、PB、市值：价格贵不贵',subtitle:'把价格放回盈利和资产的背景里',minutes:4,terms:'PE 市盈率 PB 市净率 总市值 估值 贵便宜 净资产',blocks:[
      ['市值看大小，不直接回答贵便宜','市值大致等于股价 × 已发行股数。两家公司即使股价相同，股数不同，市值也可能差很多。拆股可能降低每股价格、增加股数，本身不自动让公司更便宜。'],
      ['PE：为一单位盈利支付多少价格','PE（市盈率）约等于股价 ÷ EPS。价格 120、TTM EPS 为 6，PE 约 20 倍。它是一项价格与历史盈利的关系，不是“20 年一定回本”；盈利、股数和价格都可能变化。'],
      ['低 PE 也可能伴随高风险','先比较业务相近的公司，并检查增长、盈利持续性、负债、行业周期及一次性收益。高 PE 可能反映增长预期，也可能偏贵；低 PE 可能反映低预期或风险。EPS 不大于零时，普通的 PE 比较失去意义。'],
      ['PB：价格相对账面净资产的倍数','PB（市净率）约等于股价 ÷ 每股账面净资产。账面净资产通常来自资产负债表，并不等于立刻清算能拿到的现金。银行、制造企业与软件公司的资产结构不同；回购、商誉等也影响比较。净资产不大于零时不作通常比较。'],
      ['从哪里来','本程序优先展示 Yahoo 的 TTM PE 与最近财报口径 PB，来源缺失时不自行拼凑别家数据。市值是来源快照；财报期与估值参考行情时间要分别看。']
    ],refs:['pe'],sim:true,question:{text:'两家公司中，PE 较低的那一家是否一定更值得买？',options:['一定，数字越低越好','不一定，还要比较业务、盈利质量、增长和风险','一定，PE 就是未来收益率'],answer:1,explain:'PE 没有脱离公司背景的统一买卖阈值，盈利本身也可能不可持续。'}},
    {id:'dividends',title:'股息率和52周区间',subtitle:'历史数字不是收益保证',minutes:2,terms:'股息 分红 股息率 年化 52周 最高 最低 除息',blocks:[
      ['股息率：现金分配相对价格的比例','公司股息率通常以每股年度现金股息 ÷ 股价计算。本程序公司优先用来源的预期年度股息率；基金使用来源分配收益率。预期、过去一年分配和 SEC 收益率不是同一指标。'],
      ['高股息率不代表稳稳拿到高回报','假设年度股息 2 美元、股价 100，股息率为 2%。若股价跌到 50 而股息假设不变，比例变成 4%，但原持有人已有价格损失。公司还可能削减股息；除息也会影响价格参考。总回报要把价格变化与现金分配合在一起看。'],
      ['52 周最高和最低，是过去一年的范围','它们不是今天的高低价，也不是未来的地板和天花板。跌很多仍可能继续跌，接近历史高点也不意味着马上要跌。企业状况与市场预期可能已改变。'],
      ['从哪里来','股息和价格范围由 Yahoo/Nasdaq 整理，复权、交易覆盖和更新日可能不同。点击指标看具体来源；未知分配或缺失字段不能当成明确的零。']
    ],question:{text:'股价大跌后，显示的股息率升高了，能直接理解成更安全吗？',options:['能，股息率越高越安全','不能，要检查股价下跌原因及股息能否持续','能，分红可以保证补回亏损'],answer:1,explain:'比例升高可能来自价格下降。现金分配和股价风险必须分开检查。'}},
    {id:'etf',title:'ETF：换一套读法',subtitle:'一篮子资产与一家公司的区别',minutes:2,terms:'ETF 基金 AUM 规模 年费率 费用 份额 指数',blocks:[
      ['先看这只 ETF 持有什么','ETF 是持有一篮子资产的基金，具体可能追踪股票指数、债券或黄金等。先读投资目标、主要持仓、集中度与是否使用杠杆，再看价格。并非所有 ETF 都低风险。'],
      ['资产规模不等于便宜，也不自动推高每份价格','AUM 是管理资产的规模。份额申购赎回、资产价格及基金的不同份额类别都会影响它。本程序标为“基金资产（来源口径）”，可能包含其他份额；基准日期未提供时不能当实时 ETF 单一份额资产。'],
      ['年费率不是每次买入的手续费','例如 0.18% 表示每年运营费用占资产的比例，通常已在基金净值中体现，不是每笔下单额外扣 0.18%。它也不是年收益率。本程序不会另行模拟扣除这项费用。'],
      ['为什么公司 PE、EPS 在 ETF 上显示不适用','一只 ETF 不等同于一家经营公司。部分平台能给出组合层面 PE，但它与公司的每股盈利口径不同。本程序把公司口径标为不适用，基金资料与发行商文件才是进一步核对的起点。']
    ],question:{text:'ETF 年费率为 0.18%，应该怎么理解？',options:['每次买入和卖出都扣成交额 0.18%','基金每年运营费用占资产的比例','基金保证每年赚 0.18%'],answer:1,explain:'年费率是成本信息，通常体现在净值中，不是单笔交易费或收益承诺。'}},
    {id:'drivers',title:'数据怎样影响股价',subtitle:'从事实到预期，再到实际成交',minutes:3,terms:'涨跌 原因 预期 利率 买卖 供求 订单 利好 财报 价格',blocks:[
      ['价格最终在买卖订单中形成','愿意付出的买价和愿意接受的卖价相遇，才能成交。每笔成交都有两方；关键是双方愿意以什么价格成交、订单有多急、可成交数量多少，而不是简单数有多少人看好。'],
      ['财报通过“未来预期”影响人们愿意出的价格','盈利、产品需求、成本和经营指引会改变对未来经营及现金流的预期。市场也会比较之前已经期待的结果，所以“盈利增长”不等于“今天一定涨”。课程中的具体涨跌机制是解释框架，不是对某天实际走势的确定归因。'],
      ['盈利变好，估值也可能下降','除了盈利，利率、资金成本、行业前景与风险偏好都可能改变可接受的价格。下面的练习说明：即使 EPS 增长，若假设的估值倍数下降，算出的价格仍可能降低。'],
      ['把问题问完整','看到财报后先问：变化是持续的还是一次性的？此前预期是多少？价格里可能已反映什么？还有哪些风险？不要把 PE、成交量或新闻标题当成自动买卖按钮。']
    ],refs:['basics'],sim:true,question:{text:'公司利润增长了 10%，当天股价可能怎样？',options:['一定上涨 10%','可能涨，也可能跌，还取决于预期、估值和市场情况','一定下跌，因为利好出尽'],answer:1,explain:'单个历史指标不能确定当天股价方向，更不能给出精确涨跌幅。'}},
    {id:'sources',title:'这些数据从哪里来',subtitle:'追到出处，再检查日期和口径',minutes:3,terms:'来源 数据 日期 缓存 延迟 年报 季报 GAAP 财年 报价时间',blocks:[
      ['第一站：公司披露','公司在投资者关系网站及 SEC 公告中披露收入、利润、股数和财报期间。财报经过会计规则整理；季度数字与年度、基本与稀释、GAAP 与调整后要分别识别。'],
      ['第二站：行情与资料平台整理','Nasdaq、Yahoo 等平台将交易记录与公司资料整理成报价、TTM EPS、PE、PB 或基金数据。平台可能采用不同市场覆盖、调整方式和更新频率，不能只对比两个没有日期的数字。'],
      ['第三站：本程序展示','本程序价格和图表主要来自 Nasdaq；财务优先取 Yahoo，部分汇总字段参考 Nasdaq。完整财务快照暂存五分钟（缓存），不完整结果三十秒后可重试。软件读取时间与来源时间分开标注；缓存更新不表示公司刚发布了新财报。'],
      ['遇到不一致，用这四步检查','① 同一证券及单位吗？② 同一交易日、时段和币种吗？③ 同一财报期间与调整口径吗？④ 哪个来源提供了更新时间？仍不能核验就保留疑问，不把缺失补成零，也不把不同期间的数据硬凑公式。'],
      ['学会留一张观察卡','记录：公司怎样赚钱；当前看的数据与日期；盈利是否持续；价格相对何种盈利；一个尚不确定的问题。教程案例会按这个顺序带读，不给买卖评级。']
    ],refs:['edgar','apple','microsoft','intel'],question:{text:'“软件刚刚读取数据”可以证明什么？',options:['公司刚刚公布了最新财报','软件近期请求过来源，来源本身仍可能延迟或缓存','这一价格一定能在真实券商成交'],answer:1,explain:'读取时间、来源行情时间、财报期和可成交价格是不同概念。'}},
    {id:'cases',title:'跟着三家公司练习',subtitle:'苹果、微软与英特尔的观察卡',minutes:5,terms:'案例 苹果 AAPL 微软 MSFT 英特尔 INTC 实例',blocks:[]}
  ];
  const cases=[
    {id:'apple',symbol:'AAPL',name:'苹果',theme:'生意好懂，也要看买入价格',price:342.37,eps:8.98,pe:38.13,refs:['apple','yahoo-AAPL'],steps:[
      {title:'先说生意，再看数字',text:'苹果销售 iPhone 等硬件并提供服务。先想哪些需求能持续、产品成本怎样变化；知道品牌，并不等于已经理解未来利润。公司原始资料见其 2026 财年第四季度公告。'},
      {title:'把每股盈利和价格放在一起',text:'这张观察卡使用 2026-11-06 的来源快照：股价 342.37 美元，Yahoo TTM EPS 8.98 美元。价格除以每股盈利约为 38.13 倍。这里没有把最新单季 EPS 直接当全年。',numbers:true},
      {title:'从一个数字，走向一个问题',text:'38.13 倍不是买入或卖出指令。继续问：未来增长需要哪些条件？利润质量是否稳定？如果增长低于预期，市场愿意接受的倍数会怎样变化？这才是一张可继续核实的观察卡。'}
    ],question:{text:'看完苹果这张观察卡，哪句话更合适？',options:['PE 38.13，未来一定上涨','已知道历史盈利与价格的关系，还需核实增长和风险','EPS 就是马上发给股东的现金'],answer:1,explain:'看懂关系是起点，不能把历史比率当作未来涨跌结论。'}},
    {id:'microsoft',symbol:'MSFT',name:'微软',theme:'不能只比谁的 PE 更低',price:530.61,eps:19.16,pe:27.69,refs:['microsoft','yahoo-MSFT'],steps:[
      {title:'先拆开业务与期间',text:'微软的经营包括软件与云服务等。公司 2027 财年第一季度实际结束于 2026-09-30；“2027 财年”不表示这些是 2027 自然年的全年结果。'},
      {title:'做一次同口径计算',text:'2026-11-06 的来源快照中，股价 530.61 美元，Yahoo TTM EPS 19.16 美元，约为 27.69 倍 PE。EPS 比苹果大，不代表你买一股能立即拿到更多现金。',numbers:true},
      {title:'两个数字之外，还缺什么',text:'微软的 PE 低于这张苹果快照，但不能因此直接选微软。还要比较两者业务结构、盈利持续性、增长、资本投入和风险；跨公司比较时，先确认使用相同期间与会计口径。'}
    ],question:{text:'微软 PE 比案例中的苹果低，能直接得出什么结论？',options:['微软一定更值得买','只能说明来源快照中价格与滚动盈利的倍数较低','微软未来收益一定更高'],answer:1,explain:'相同口径的倍数可以比较，买卖结论还需要更多背景。'}},
    {id:'intel',symbol:'INTC',name:'英特尔',theme:'单季赚钱，滚动一年仍可能亏损',price:56.28,eps:-2.35,pe:null,refs:['intel','yahoo-INTC'],steps:[
      {title:'先把两个期间分开',text:'英特尔 2026-10-29 的公告披露第三季度 GAAP 稀释 EPS 为 0.60 美元；这只覆盖该季度。单季盈利不能直接证明过去十二个月整体盈利。'},
      {title:'负 EPS 怎么读',text:'2026-11-06 的来源快照中，价格 56.28 美元，Yahoo TTM EPS 为 -2.35 美元。来源滚动口径为负，程序把 PE 标为不具通常比较意义，而不是给一个负倍数让人误认为“特别便宜”。',numbers:true},
      {title:'先调查亏损的原因',text:'继续查：亏损来自持续经营压力还是一次性项目？季度改善是否持续？现金、负债与投入需要怎样的资金支持？这些问题没有核实前，不把“股价低”或“亏损后有好季度”当作反弹保证。'}
    ],question:{text:'季度 EPS 为正，但 TTM EPS 为负，是否一定有一项数据错了？',options:['一定有错','不一定，覆盖期间不同，还需核对调整口径','把负 EPS 的负号去掉就可以比 PE'],answer:1,explain:'一个季度与过去十二个月并不相同；先看期间和会计口径，不能随意改符号。'}}
  ];
  const caseExtras={
    apple:[['市值：约 4.98 万亿美元','这描述来源快照中的公司规模，不是账上现金。单股价格与公司大小要分开看。'],['PB：约 44.39 倍','价格相对账面净资产的倍数较高。继续核对资产结构、回购和盈利质量，不能单凭 PB 下结论。'],['股息率：约 0.32%','这是来源的预期年度现金股息比例，不是全年总收益率，也不承诺未来维持。'],['52 周：243.42–355.38 美元','历史区间提供背景；过去的最低或最高价格都不是未来边界。']],
    microsoft:[['市值：约 3.94 万亿美元','市值用于观察公司规模。与苹果比较时，不能用两者单股价格直接比较公司大小。'],['PB：约 8.38 倍','低于苹果这张快照不等于一定更便宜；两家公司资产结构与经营情况仍需核对。'],['股息率：约 0.74%','股息率与股价、年度股息假设有关，不能忽略价格变化与股息调整。'],['52 周：349.20–559.15 美元','当前快照在历史区间里的位置，只是背景信息，不提供确定的涨跌方向。']],
    intel:[['市值：约 2991 亿美元','即使单股价格低于其他公司，仍需结合股数、市值及经营情况看整体。'],['PB：约 2.60 倍','正的账面净资产倍数与负的 TTM EPS 可以同时存在，两项衡量的内容不同。'],['股息率：来源为 0%','这里的零是来源明确提供的值；其他字段显示缺失时，不能也当作零。'],['52 周：32.89–142.35 美元','波动范围很宽也不保证一定反弹。先检查经营变化、风险和资料日期。']]
  };
  function extrasHtml(c){return '<section class="tutorial-case-extras"><h3>延伸阅读：每次再看一个数字</h3>'+caseExtras[c.id].map(([h,t])=>'<details><summary>'+esc(h)+'</summary><p>'+esc(t)+'</p></details>').join('')+'</section>';}
  const topicMap={pe:'valuation',pb:'valuation',marketCap:'valuation',eps:'earnings',dividendYield:'dividends',week52High:'dividends',week52Low:'dividends',aum:'etf',expenseRatio:'etf'};
  const key='e-equity.tutorial.v1',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
  function model(growth,multiple){growth=Number(growth);multiple=Number(multiple);if(!Number.isFinite(growth)||!Number.isFinite(multiple))throw Error('练习参数无效');growth=Math.max(-50,Math.min(50,growth));multiple=Math.max(5,Math.min(40,multiple));const eps=6*(1+growth/100),price=eps*multiple;return {growth,multiple,eps,price,change:(price/120-1)*100};}
  function restore(storage){try{const d=JSON.parse(storage.getItem(key));return {lesson:lessons.some(l=>l.id===d?.lesson)?d.lesson:'quotes',completed:[...new Set((Array.isArray(d?.completed)?d.completed:[]).filter(id=>lessons.some(l=>l.id===id)))]};}catch{return {lesson:'quotes',completed:[]};}}
  const isReference=url=>references.some(r=>r.url===url);
  let context=null,state={lesson:'quotes',completed:[]},answers={},caseId='apple',caseStep=0,query='',mounted=false;
  function save(){try{context.storage.setItem(key,JSON.stringify(state));}catch{}}
  function refHtml(ids){return `<div class="tutorial-references"><strong>查看出处</strong>${ids.map(id=>{const r=references.find(x=>x.id===id);return r?`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} ↗</a>`:'';}).join('')}</div>`;}
  function quizHtml(q,id){const selected=answers[id],answered=Number.isInteger(selected);return `<section class="tutorial-quiz" aria-label="理解小检查"><p class="tutorial-kicker">想一想，不用记术语</p><h3>${esc(q.text)}</h3><div>${q.options.map((s,i)=>`<button data-tutorial-answer="${i}" data-question="${id}" aria-pressed="${selected===i}" class="quiz-choice ${selected===i?(i===q.answer?'correct':'incorrect'):''}"><span>${i+1}</span>${esc(s)}</button>`).join('')}</div><p class="quiz-feedback" role="status">${answered?`${selected===q.answer?'理解对了。':'再想一下。'}${esc(q.explain)}`:'选择一个答案，看看解释。'}</p></section>`;}
  function simHtml(){return `<section class="tutorial-simulator"><p class="tutorial-kicker">互动练习 · 人为设定，非真实公司预测</p><h3>盈利增长，为什么假设价格还会跌？</h3><p>起点：每股盈利 $6 × 20 倍 PE = $120。试着改变未来盈利和假设估值。</p><label for="tutorial-growth">假设每股盈利变化 <output id="tutorial-growth-value">+20%</output></label><input id="tutorial-growth" type="range" min="-50" max="50" value="20" step="5"><label for="tutorial-multiple">假设愿意支付的 PE <output id="tutorial-multiple-value">14 倍</output></label><input id="tutorial-multiple" type="range" min="5" max="40" value="14"><div id="tutorial-model-result" class="tutorial-model-result" aria-live="polite"></div><p class="tutorial-caption">这是在给定假设下的关系式演示。PE 也受价格影响，不能用任意倍数算出的数字预测未来股价。</p></section>`;}
  function updateModel(){const v=model(context.$('#tutorial-growth').value,context.$('#tutorial-multiple').value);context.$('#tutorial-growth-value').textContent=`${v.growth>0?'+':''}${v.growth}%`;context.$('#tutorial-multiple-value').textContent=v.multiple+' 倍';context.$('#tutorial-model-result').innerHTML=`<span>假设 EPS ${money(v.eps)} × ${v.multiple} 倍</span><strong>${money(v.price)}</strong><span>相对起点 ${v.change>0?'+':''}${v.change.toFixed(1)}%</span><p>${v.growth>0&&v.change<0?'盈利增长，但给定估值下降后，假设价格仍下降。':'数字取决于你设定的盈利和估值，市场不会承诺这个结果。'}</p>`;}
  function caseHtml(){const c=cases.find(x=>x.id===caseId),step=c.steps[caseStep];return `<div class="tutorial-case-tabs" role="group" aria-label="选择公司案例">${cases.map(x=>`<button class="secondary-button" data-tutorial-case="${x.id}" aria-pressed="${x.id===caseId}">${esc(x.name)} ${x.symbol}</button>`).join('')}</div><p class="tutorial-snapshot">真实来源快照 · 2026-11-06（纽约交易日）· 不是当前行情<br>报价：Nasdaq；TTM 财务：Yahoo Finance。公司公告是另一种期间，阅读时分开核对。</p><p class="tutorial-kicker">${esc(c.theme)} · 第 ${caseStep+1} / 3 步</p><h3>${esc(step.title)}</h3><p class="tutorial-case-text">${esc(step.text)}</p>${step.numbers?`<div class="tutorial-case-numbers"><div><span>来源价格</span><strong>${money(c.price)}</strong></div><div><span>EPS · TTM</span><strong>${money(c.eps)}</strong></div><div><span>PE · TTM</span><strong>${c.pe===null?'不具比较意义':c.pe.toFixed(2)+' 倍'}</strong></div></div>`:''}<div class="tutorial-case-actions"><button class="secondary-button" data-case-step="-1" ${caseStep===0?'disabled':''}>上一步</button><button class="button" data-case-step="1" ${caseStep===2?'disabled':''}>下一步</button></div>${caseStep===2?extrasHtml(c)+quizHtml(c.question,'case-'+c.id):''}${refHtml(c.refs)}<button class="text-button" data-tutorial-observe="${c.symbol}">查看 ${c.symbol} 当前行情与来源 ↗</button><p class="tutorial-caption">当前行情可能与案例快照不同。跳转只查看行情，不提交买卖。</p>`;}
  function renderNav(){const q=query.trim().toLowerCase();const items=lessons.filter(l=>`${l.title} ${l.subtitle} ${l.terms}`.toLowerCase().includes(q));context.$('#tutorial-index').innerHTML=items.map((l,i)=>`<button data-tutorial-lesson="${l.id}" class="tutorial-lesson-link ${state.lesson===l.id?'selected':''}" aria-current="${state.lesson===l.id?'step':'false'}"><span>${state.completed.includes(l.id)?'✓':String(lessons.indexOf(l)+1).padStart(2,'0')}</span><div><strong>${esc(l.title)}</strong><small>${l.minutes} 分钟 · ${esc(l.subtitle)}</small></div></button>`).join('')||'<p class="tutorial-caption">没有找到课程。试试“PE”“盈亏”或“数据来源”。</p>';context.$('#tutorial-progress').textContent=`已学 ${state.completed.length} / ${lessons.length} 课 · 进度保存在本设备`;}
  function render(){if(!context)return;const l=lessons.find(x=>x.id===state.lesson)||lessons[0];renderNav();context.$('#tutorial-article').innerHTML=`<header class="tutorial-article-heading"><p class="tutorial-kicker">新手课堂 · ${l.minutes} 分钟</p><h2 tabindex="-1" id="tutorial-lesson-title">${esc(l.title)}</h2><p>${esc(l.subtitle)}</p></header>${l.id==='cases'?caseHtml():`${l.blocks.map(([h,t])=>`<section class="tutorial-explanation"><h3>${esc(h)}</h3><p>${esc(t)}</p></section>`).join('')}${l.id==='drivers'?'<ol class="tutorial-chain"><li>经营事实与消息</li><li>未来盈利预期与风险判断</li><li>愿意支付的价格与买卖订单</li><li>实际成交价格</li></ol>':''}${l.sim?simHtml():''}${quizHtml(l.question,l.id)}${l.refs?refHtml(l.refs):''}`}<footer class="tutorial-lesson-footer"><button class="secondary-button" data-tutorial-complete>${state.completed.includes(l.id)?'✓ 已学完这课':'标记这课已学完'}</button><button class="button" data-tutorial-next>${lessons.indexOf(l)===lessons.length-1?'回到行情，继续观察':'下一课 →'}</button></footer>`;if(l.sim)updateModel();}
  function open(topic){if(!context)return;const id=topicMap[topic]||topic;state.lesson=lessons.some(l=>l.id===id)?id:state.lesson;save();render();}
  function init(options){if(mounted)return;mounted=true;context=options;state=restore(context.storage);const container=context.$('#view-tutorial');if(!container)return;container.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.tutorialLesson){open(b.dataset.tutorialLesson);context.$('#tutorial-lesson-title').focus();}
    if(b.dataset.tutorialCase&&cases.some(c=>c.id===b.dataset.tutorialCase)){caseId=b.dataset.tutorialCase;caseStep=0;render();}
    if(b.dataset.caseStep){caseStep=Math.max(0,Math.min(2,caseStep+Number(b.dataset.caseStep)));render();}
    if(b.dataset.tutorialAnswer!==undefined){const q=state.lesson==='cases'?cases.find(x=>x.id===caseId).question:lessons.find(x=>x.id===state.lesson).question;const i=Number(b.dataset.tutorialAnswer);if(Number.isInteger(i)&&i>=0&&i<q.options.length){answers[b.dataset.question]=i;const section=b.closest('.tutorial-quiz');section.querySelectorAll('.quiz-choice').forEach((button,index)=>{button.setAttribute('aria-pressed',index===i);button.classList.toggle('correct',index===i&&i===q.answer);button.classList.toggle('incorrect',index===i&&i!==q.answer);});section.querySelector('.quiz-feedback').textContent=(i===q.answer?'理解对了。':'再想一下。')+q.explain;}}
    if(b.hasAttribute('data-tutorial-complete')){if(!state.completed.includes(state.lesson))state.completed.push(state.lesson);save();render();}
    if(b.hasAttribute('data-tutorial-next')){const next=lessons[lessons.findIndex(x=>x.id===state.lesson)+1];if(next){open(next.id);context.$('#tutorial-lesson-title').focus();}else context.navigate('terminal');}
    if(b.dataset.tutorialObserve)context.observe(b.dataset.tutorialObserve);
  });container.addEventListener('input',event=>{if(event.target.id==='tutorial-search'){query=event.target.value;renderNav();}if(['tutorial-growth','tutorial-multiple'].includes(event.target.id))updateModel();});render();}
  return {lessons,cases,references,isReference,model,restore,init,open,render,topicMap};
});
