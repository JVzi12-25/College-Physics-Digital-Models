# 电磁学 [2]：从恒定磁场到电磁波

本项目包按“真空中的恒定磁场”理解需求中的“恒温磁场”，内容按 **静磁场 → 磁介质 → 电磁感应 → 电磁振荡 → 电磁波** 递进。方案中的 7 个模型现已全部完成；所有模型均可在页面顶部标签间切换。

## 交互模型

| 顺序 | 模型 | 交互与主要观察量 | 状态 |
| --- | --- | --- | --- |
| 1 | 电流如何产生磁场 | 切换无限长直导线、圆形电流环和理想长螺线管；调节电流、半径或匝密度，拖动磁场探针查看方向与场强 | 已完成 |
| 2 | 磁场中的运动电荷 | 选择电子或质子，改变均匀磁场、初速度和入射角；播放、暂停、逐步和重置，观察轨迹、洛伦兹力、回旋半径与周期 | 已完成 |
| 3 | 磁介质与磁滞 | 比较铋（抗磁）、铝（顺磁）与铁磁教学模型；扫描外磁场，查看 `M—H` 曲线、磁化强度、介质内 `B` 和剩磁 | 已完成 |
| 4 | 磁通量与法拉第感应 | 改变线圈匝数、面积、磁场、转动频率及初始夹角；播放或逐步查看磁通链和感应电动势 | 已完成 |
| 5 | 导体棒切割磁感线 | 改变磁场方向与大小、棒长、速度、电阻和棒的位置；播放导体棒运动，查看感应电流、磁阻力和功率平衡 | 已完成 |
| 6 | LC / RLC 电磁振荡 | 调整 `L`、`C`、`R` 与初始电压，在欠阻尼、临界阻尼和过阻尼间切换；查看电荷、电流及电场能、磁场能和耗散能 | 已完成 |
| 7 | 真空平面电磁波 | 改变频率、电场振幅、线偏振角和相位；播放或逐步观察 `E`、`B`、波长、波速与平均能流强度 | 已完成 |

## 物理模型与边界

- 无限长直导线使用 `B = μ₀|I|/(2πr)`；圆形电流环只对轴线上探针给出精确场强，离轴场线为示意；理想长螺线管使用 `B = μ₀n|I|`，忽略端部效应。
- 运动电荷在均匀恒定磁场中采用非相对论解析螺旋轨迹，因此动画不产生数值积分造成的速率漂移。
- 铋和铝按弱场线性磁化率示例计算。铁磁模型为简化的带历史状态磁滞模型，展示饱和、剩磁和矫顽场趋势，不代表某种材料的实测数据；磁畴图示为定性放大。
- 感应线圈处于均匀恒定磁场内并匀速转动，以线圈法线定义正磁通，使用 `Φ_B = BA cos θ` 和 `ε = −d(NΦ_B)/dt`。动画时间放慢，参数读数使用实际设定的频率。
- 导体棒以设定恒速垂直切割匀强磁场，采用 `|ε| = BL|v|`、`I = ε/R`；维持匀速的外力提供机械功率，等于电阻上的焦耳热功率。
- 串联 RLC 从电容初始带电、电流为零开始，使用解析解处理三种阻尼状态；能量余额作为电阻耗散能。真空平面波使用 `c = 1/√(μ₀ε₀)`、`E₀/B₀ = c`，图中绘制 `cB` 以便与 `E` 共用幅度标尺。
- Canvas 拖动可用于模型 1 探针；模型 5 通过位置滑块设置导体棒位置，并提供运动播放。

## 本地测试

在仓库根目录启动任意静态 HTTP 服务后打开 `电磁学[2]/index.html`。计算关系独立放在 `js/physics.js`，页面绘制和交互分别放在 `js/app.js` 与 `js/advanced.js`。可用 Node.js 运行物理不变量测试：

```powershell
node --input-type=module -e 'await import("./电磁学[2]/js/physics.test.js")'
```

测试覆盖磁介质响应、法拉第电动势符号、动生电动势与功率、RLC 三种阻尼和能量、磁滞路径依赖及真空波关系。

## 参考章节

模型顺序和公式参考 OpenStax《University Physics Volume 2》：[细直导线的磁场](https://openstax.org/books/university-physics-volume-2/pages/12-2-magnetic-field-due-to-a-thin-straight-wire)、[圆形电流环的磁场](https://openstax.org/books/university-physics-volume-2/pages/12-4-magnetic-field-of-a-current-loop)、[螺线管与环形线圈](https://openstax.org/books/university-physics-volume-2/pages/12-6-solenoids-and-toroids)、[磁介质](https://openstax.org/books/university-physics-volume-2/pages/12-7-magnetism-in-matter)、[法拉第定律](https://openstax.org/books/university-physics-volume-2/pages/13-1-faradays-law)、[楞次定律](https://openstax.org/books/university-physics-volume-2/pages/13-2-lenzs-law)、[动生电动势](https://openstax.org/books/university-physics-volume-2/pages/13-3-motional-emf)、[LC 振荡](https://openstax.org/books/university-physics-volume-2/pages/14-5-oscillations-in-an-lc-circuit)、[RLC 串联电路](https://openstax.org/books/university-physics-volume-2/pages/14-6-rlc-series-circuits)和[平面电磁波](https://openstax.org/books/university-physics-volume-2/pages/16-2-plane-electromagnetic-waves)。各交互图由本项目自行实现。
