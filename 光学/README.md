# 光学：几何光学与波动光学

本项目包包含 4 个可交互模型。页面沿用大学物理交互模型的章节选择器、模型导航和暗色实验面板；计算函数与 Canvas 绘制分开放在 `physics.js` 和 `app.js`。

线上页面：[打开光学交互实验室](https://jvzi12-25.github.io/College-Physics-Digital-Models/%E5%85%89%E5%AD%A6/index.html)。

## 交互模型

| 顺序 | 模型 | 可调参数 | 主要观察量 |
| --- | --- | --- | --- |
| 1 | 反射与折射 | 两侧折射率、入射角 | 反射角、折射角、临界角与全反射条件 |
| 2 | 薄透镜成像 | 会聚或发散透镜、焦距、物距、物高 | 主光线、像距、放大率，以及像的正倒和虚实 |
| 3 | 杨氏双缝干涉 | 波长、双缝间距、屏距、屏幕观察范围 | 固定物理坐标中的干涉条纹、归一化强度曲线、相邻亮纹间距；可适配视野或保存曲线作对照 |
| 4 | 单缝衍射 | 波长、缝宽、屏距、屏幕观察范围 | 固定物理坐标中的中央主极大与旁瓣、归一化强度曲线、暗纹角度；可适配视野或保存曲线作对照 |

## 物理关系与模型条件

- 平面介质边界使用 Snell 定律 `n₁ sin θ₁ = n₂ sin θ₂`；当 `n₁ > n₂` 时，临界角为 `θc = asin(n₂/n₁)`。角度从法线量起；超过临界角后只绘制反射光。
- 薄透镜使用 `1/f = 1/s + 1/s′` 和 `m = −s′/s`。凸透镜焦距为正，凹透镜焦距为负。近轴近似成立，透镜视为无厚度；物体处于凸透镜焦平面时显示无穷远像。
- 双缝采用等强、相干点光源，强度按 `I/I₀ = cos²(πd sin θ/λ)` 计算。横向屏坐标使用 `sin θ = y/√(L²+y²)`；显示的亮纹间距使用小角度近似 `Δy ≈ λL/d`。
- 单缝夫琅禾费衍射按 `I/I₀ = (sin β/β)²` 计算，其中 `β = πa sin θ/λ`。在 `β = 0` 处取连续极限 1。第 m 级暗纹满足 `a sin θ = mλ`；显示的中央主极大宽度使用近轴近似 `2λL/a`。
- 双缝和单缝均假设单色光垂直入射、屏距远大于孔径尺寸；模型不含偏振、材料色散、有限屏宽和光源相干长度等效应。彩色光强曲线仅作归一化示意。
- 干涉与衍射曲线按屏幕上的固定物理坐标绘制。调整参数会改变条纹或衍射包络的真实间距；“适配当前参数”只调整观察范围，“保存当前曲线作对照”用于比较参数变化前后的分布。

## 页面运行

在 PowerShell 中从仓库根目录启动项目已有的本地服务：

```powershell
Set-Location -LiteralPath '电磁学[1]'
npm start
```

然后打开 `http://localhost:4173/光学/index.html`。模块脚本需通过 HTTP(S) 加载；直接双击 HTML 文件可能受浏览器模块安全策略限制。

物理公式的边界和基准算例可在 `光学` 目录执行 `npm test` 验证。

## 教材参考

公式和模型边界可对照 OpenStax《University Physics Volume 3》：[折射](https://openstax.org/books/university-physics-volume-3/pages/1-3-refraction)、[全反射](https://openstax.org/books/university-physics-volume-3/pages/1-4-total-internal-reflection)、[薄透镜](https://openstax.org/books/university-physics-volume-3/pages/2-4-thin-lenses)、[杨氏双缝干涉](https://openstax.org/books/university-physics-volume-3/pages/3-1-youngs-double-slit-interference)和[单缝衍射强度](https://openstax.org/books/university-physics-volume-3/pages/4-2-intensity-in-single-slit-diffraction)。页面绘图与交互代码为本项目独立实现。
