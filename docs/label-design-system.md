# Runners Life 鞋墙标签设计规范

状态：**Approved baseline / 已确认主基调**  
设计方案：**Scheme A — Red / White**  
配置版本：`1.1.0`  
参数源：[label-design-system.json](../design/label-design-system.json)

## 1. 目的

本规范用于指导 Runners Life 本地标签编辑与打印程序的 UI、SVG 生成、打印预览和视觉回归测试。

最终标签安装在 9 英寸宽、1 英寸高的透明亚克力标牌槽中。标签必须远距离容易识别，在整面鞋墙中保持统一，同时让品牌、型号、主要卖点和价格具有清晰的信息层级。

本项目以红白方案为默认视觉系统。此前的红黑版本仅保留为探索稿，不作为产品默认主题。

## 2. 已确认的视觉原则

1. 标签采用简洁、高对比的红白配色。
2. 左侧只显示 Runners Life 跑者枫叶图形，不显示 `Runners Life` 文字。
3. 左侧红色区域保持窄幅，图形反转为纯白并直接落在红底上，不使用白色圆形底片。
4. 第二个区域固定用于品牌 Logo。
5. New Balance、Saucony、ASICS、Brooks 必须使用各自官网提供的标准 Logo；Saucony 使用官网黑色版本。
6. 所有品牌使用相同宽度的品牌区域，但 Logo 本身保持原始比例，不允许拉伸。
7. 鞋型号使用标签中最大的正文层级。
8. 型号下方可显示 0–3 个卖点，不使用卖点图标。
9. 没有卖点时，型号在产品内容区垂直居中；有多个卖点时使用细红色竖线分隔。
10. 打折状态必须在远距离与常规价格明显区分，不能只依赖划线原价。
11. 非打折状态不显示 `SALE`、原价划线或节省金额。

## 3. 标签物理尺寸

| 参数 | 数值 |
| --- | ---: |
| 裁切宽度 | 220mm |
| 裁切高度 | 23mm |
| SVG viewBox | `0 0 2200 230` |
| 换算比例 | 10 SVG 单位 = 1mm |
| 打印比例 | 100% |
| 允许物理误差 | ±0.5mm |

禁止在打印机或 PDF 阅读器中使用“适合页面”“缩放到可打印区域”等选项。

### 3.1 可调尺寸（程序设置）

220×23mm 是已确认的基准方案，也是默认值。应用内可以在预览面板调整标签的宽和高，设置随本地数据保存，并同时作用于预览、打印与 PDF 导出。

| 限制 | 数值 |
| --- | ---: |
| 宽度 | 160–240mm |
| 高度 | 23–30mm |
| 宽高比（宽 ÷ 高） | 6.5:1 – 10.5:1 |

宽、高的可调范围始终固定（160–240mm、23–30mm），不会随另一项变化。宽高比限制保证产品内容区既不会被挤得放不下卖点，也不会过于空旷（例如 160×30mm 是 5.3:1，无法排版）：如果某次修改会使宽高比超出范围，程序保留用户刚输入的值，自动调整另一项，并在面板中提示调整前后的数值。

渲染规则：画布高度固定为 230 单位，宽度为 `230 × 宽 ÷ 高`（220×23mm 即 2200，与基准完全一致）。

- 调整**高度**＝整体等比缩放，所有字号、Logo 随之变大变小。
- 调整**宽度**＝改变产品内容区的可用宽度，型号与卖点的位置按剩余宽度等比分布。宽度不低于基准（画布宽 ≥ 2200 单位）时，标志区与品牌区（`x=0…600`）和右侧价格区（最右 532 单位，始终贴右）保持原大小，多出的宽度全部给内容区。
- **窄于基准时**，左侧标志／品牌区与右侧价格区按比例收窄：缺少的宽度由这两块与内容区各承担一半（收窄系数 `q = 1 − 0.5 × (2200 − 画布宽) ÷ 1132`，例如 160×23mm 时 q≈0.735）。收窄是等比缩小——Logo、价格、SALE 封印随之变小，不拉伸；其底色形状只在水平方向收窄。这样 160mm 宽时内容区仍约有基准的 77%。
- 文字放不下时，先在 80% 范围内缩小字号，仍放不下再横向压缩字形，不会溢出到相邻区域。基准尺寸下已确认的文字不会被改动。

### 3.2 卖点文字大小（程序设置）

三个卖点的字号可在预览面板单独调整：相对已确认设计的 **80%–170%**，默认 100%，作用于所有标签。面板同时显示换算后的实际打印字号（pt），便于判断可读性（23mm 高、100% 时约 6.0pt，150% 约 8.9pt）。

- 卖点之间的红色竖线随文字等比加高。
- 字号是“期望值”：太长放不下的短语仍会自动缩小，但最小只缩到已确认设计原本会使用的字号（原字号的 80%），再不够才压缩字形——所以放大后短语更醒目，长短语不会比原设计更小。
- 文字位置（基线 `y=162`）与各槽位宽度不变；100% 时输出与已确认方案完全一致。
- A4 拼版：每页张数 = `floor(184mm ÷ 高度)`（23mm 为 8 张），整组标签在页面内水平、垂直居中；裁切标记随标签尺寸移动。
- 单张打印：页面尺寸即标签尺寸。

## 4. 横向区域划分

标签从左至右分为四个区域：

| 区域 | SVG 范围 | 约合宽度 | 用途 |
| --- | --- | ---: | --- |
| Runners Life 标志区 | `x=0…250` | 25mm | 窄红色底、白色反转图形、无圆形底片 |
| 品牌区 | `x=250…600` | 35mm | 品牌标准彩色 Logo |
| 产品内容区 | `x=600…1668` | 106.8mm | 型号与三个卖点 |
| 价格区 | `x=1668…2200` | 53.2mm | 常规价格或促销信息 |

Runners Life 标志区和品牌区存在少量斜切视觉重叠；实际内容不得越过各自的安全边界。

## 5. Runners Life 标志区

- 使用现有 [logo.svg](../logo.svg) 左侧的跑者／枫叶图形。
- 不显示后方的 `Runners Life` 字样。
- 标志使用源 SVG 的透明轮廓作为遮罩，并统一输出为纯白色。
- 跑者镂空部分保持透明，使红色背景自然透出并形成反转效果。
- 不绘制白色圆形底片或外围描边。
- 标志参考边界为 `x=18, y=18, width=172, height=194`；对应源 SVG 的 `x=0…128`，不得包含后方文字。
- 必须使用 `preserveAspectRatio="xMidYMid meet"`，禁止横向挤压或非等比缩放。
- 红色背景采用轻微的深浅渐变，并可叠加透明度不超过 8% 的斜向速度线。
- 不允许用生成式图片重新绘制正式图标；正式打印必须使用现有矢量源文件。

## 6. 品牌 Logo 区

品牌区必须始终占用固定的 35mm 宽度。即使某个品牌 Logo 较窄，也不能把剩余空间分配给型号或其他内容，否则不同标签无法形成整齐的鞋墙网格。

Logo 的统一方式：

- 使用统一的外部容器：`350 × 230` SVG 单位。
- 使用统一的 artwork 边界：`x=270, y=45, width=300, height=140`。
- 使用 `preserveAspectRatio="xMidYMid meet"`。
- 禁止横向或纵向拉伸。
- 禁止统一改成黑色或白色；必须使用品牌标准颜色。
- 可以通过 `opticalScale` 做视觉大小校准。
- 特殊品牌的偏移量只能写入 JSON，不能散落在 React 或 CSS 中。

当前资产和颜色：

| 品牌 | 资产 | 主色 | Optical scale |
| --- | --- | --- | ---: |
| New Balance | `design/assets/brands/new-balance.svg` | `#E21836` | 0.86 |
| Saucony | `design/assets/brands/saucony.svg` | `#231F20` | 1.00 |
| ASICS | `design/assets/brands/asics.svg` | `#000066` | 0.88 |
| Brooks | `design/assets/brands/brooks.svg` | `#3275BF` | 1.00 |

Optical scale 不是品牌区宽度，而是 Logo 在固定区域内的视觉修正。后续如增加品牌，必须先制作彩色 SVG，再添加相应 JSON 配置。

品牌识别参考：

- New Balance：[Official Digital Assets / Brandfolder](https://brandfolder.com/new-balance)
- Saucony：[Saucony Canada 官方黑色 SVG](https://www.saucony.com/on/demandware.static/Sites-saucony_ca-Site/-/default/dwf24e0794/images/logo.svg)
- ASICS：[Brand & Trademark](https://corp3.asics.com/en/focus/ip/brand)
- Brooks：[Meet Brooks / Our Company](https://www.brooksrunning.com/en_us/Meet-Brooks/our-company/)

上述链接用于核对当前品牌标识形态。项目内使用离线 SVG，运行和打印时不得从网络加载 Logo。正式商业使用仍应遵守品牌方商标规范和 Runners Life 的经销授权。

## 7. 型号与卖点

### 型号

- 默认字号：54 SVG 单位，约 5.4mm。
- 字重：900。
- 使用紧凑型无衬线字体。
- 默认转换为大写。
- 只允许一行。
- 字号可以自动缩小，但不得低于 42 SVG 单位。
- 达到最小字号后仍然溢出时，编辑器必须提示用户缩短型号，不能继续压缩或截断。

### 卖点

- 允许 0–3 条，全部可选。
- 没有卖点时，型号基线移动至 `y=137`，在产品内容区内垂直居中。
- 每条只允许一行。
- 不显示卖点图标。
- 三条卖点横向排列，以红色细竖线分隔。
- 默认字号：20 SVG 单位；最小字号：18。
- 内容溢出时在编辑界面显示校验错误，不在打印时自动换行。

建议用户使用短语，例如：

- `LIGHTWEIGHT & RESPONSIVE`
- `SPEEDROLL TECHNOLOGY`
- `BUILT FOR TEMPO RUNS`

## 8. 常规价格状态

满足下列任一条件时使用常规价格状态：

- 没有填写折扣价。
- 折扣价为空。
- 折扣价大于或等于正常价格。

常规状态只显示正常价格，例如 `$229.99`。价格在红色区域内水平、垂直居中，不增加标题或装饰线，以保持最简洁的视觉层级。

不得显示：

- `SALE`
- `REGULAR PRICE` 标题
- 价格下方装饰线
- 划线价格
- `SAVE`
- 伪造的零元优惠

基准 SVG：[label-a-red-white-regular.svg](../design/variants/label-a-red-white-regular.svg)

## 9. SALE 状态

SALE 状态必须同时满足：

```text
salePrice 已填写，并且 salePrice < regularPrice
```

促销状态包含四个元素：

1. 大型圆形 `SALE` 封印。
2. 划线的正常价格。
3. 最大字号的折扣价格。
4. 自动计算的 `SAVE $xx`。

### SALE 封印

- 类型：双层圆形印章。
- 外径：144 SVG 单位，约 14.4mm。
- 中心位置：`1698, 76`。
- 逆时针旋转 10°。
- 白色底，深红外圈，红色虚线内圈。
- `SALE` 使用红色粗体大写文字。
- 封印直接压在产品区与价格区的红色斜切分割线上，以获得更强的促销识别。
- 封印不应遮挡鞋型号、品牌 Logo 或折扣价格。

### 价格计算

```ts
const savings = regularPrice - salePrice;
```

- 正常价格和折扣价格统一保留两位小数。
- `SAVE` 默认显示货币金额，不显示百分比。
- 如果计算结果小于或等于 0，必须回退到常规价格状态。

基准 SVG：[label-a-red-white-sale.svg](../design/variants/label-a-red-white-sale.svg)

## 10. 字体

应用随安装包离线打包 `Barlow Condensed` 的 600、800、900 三个字重，避免不同 Windows 电脑因为缺少字体或断网而产生排版差异。

- 鞋型号：ExtraBold 800，突出产品名称但避免字面过黑。
- 卖点：SemiBold 600，在 23 mm 高度下保持清晰。
- 主价格：Black 900，并启用 `tabular-nums lining-nums`，让不同价格的数字宽度稳定。
- 价格拆分为三个字号层级：货币符号较小并上移，整数最大，小数次一级。禁止把整个价格压成同一字号。

回退顺序：

```css
font-family: "Barlow Condensed", "Arial Narrow", "Segoe UI", Arial, sans-serif;
font-variant-numeric: tabular-nums lining-nums;
```

正式打印前需要等待字体加载完成，否则 Chromium 可能使用临时回退字体进行排版。

## 11. 数据到 SVG 的映射

建议标签组件接收以下数据：

```ts
interface ShoeLabelData {
  brand: "new-balance" | "saucony" | "asics" | "brooks";
  model: string;
  regularPrice: number;
  salePrice?: number;
  features: [string, string, string]; // 每项可为空，允许全部为空
}
```

价格状态应由数据推导，不能让 UI 单独保存一个可能与价格冲突的 `isSale`：

```ts
const isSale =
  Number.isFinite(shoe.salePrice) &&
  shoe.salePrice! < shoe.regularPrice;
```

## 12. JSON 参数的使用规则

[label-design-system.json](../design/label-design-system.json) 是后续实现的设计参数源。

开发要求：

1. React 标签组件从 JSON 读取画布、区域、颜色、字号和 SALE 封印参数。
2. 不要在多个组件中重复硬编码坐标。
3. 品牌配置通过品牌 ID 查找。
4. 所有坐标以 SVG viewBox 单位保存。
5. 修改 JSON 后必须重新生成 SVG 预览并执行视觉回归检查。
6. 如果 JSON 结构发生不兼容变化，递增主版本号。

## 13. 打印要求

- 输出尺寸默认 220×23mm，也可按 3.1 在允许范围内调整；打印时页面尺寸必须与所选标签尺寸完全一致。
- `@page` 或 Electron 打印参数必须使用精确物理尺寸。
- 打印比例为 100%。
- 必须启用背景颜色和背景图形。
- 禁止浏览器页眉、页脚和默认页面边距。
- 第一次连接新打印机时打印尺寸校准条。
- 校准条实际测量误差应控制在 ±0.5mm 内。

## 14. 开发验收清单

- [ ] 标签实际尺寸与设置一致（默认 220×23mm）。
- [ ] 左侧显示放大的官方彩色 Runners Life 图形，并且没有横向挤压。
- [ ] 左侧图形位于白色圆形底片上，窄红色区域仍然清晰可见。
- [ ] 四个品牌区宽度完全相同。
- [ ] 品牌 Logo 保持彩色和原始比例。
- [ ] 型号在正常观看距离下最醒目。
- [ ] 卖点没有图标且最多三条。
- [ ] SALE 封印在缩略图和实体打印中都清晰可见。
- [ ] 常规价格区只显示价格数字，不包含标题、装饰线或促销元素。
- [ ] 原价、折扣价和 SAVE 金额计算正确。
- [ ] 超长型号与卖点在编辑阶段被拦截。
- [ ] Windows 实机打印没有字体替换或布局漂移。

## 15. 当前参考文件

- 红白／SALE：[label-a-red-white-sale.svg](../design/variants/label-a-red-white-sale.svg)
- 红白／常规价格：[label-a-red-white-regular.svg](../design/variants/label-a-red-white-regular.svg)
- 已确认红白方案预览：[label-scheme-a-approved.png](../design/label-scheme-a-approved.png)
- 四品牌彩色 Logo 对比：[label-brand-comparison.png](../design/label-brand-comparison.png)
- 历史四状态对比：[label-scheme-a-four-variants.png](../design/label-scheme-a-four-variants.png)
- 设计参数：[label-design-system.json](../design/label-design-system.json)
