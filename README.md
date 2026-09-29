# 大学物理交互模型

通过可调参数与动态示意图探索大学物理规律。模型页面提供公式、实验读数和适用条件，覆盖电磁学与光学。项目首页带有轻量粒子动效；各章节使用统一的深色实验室界面，参数变化会同步更新光路、场线、轨迹或强度图。

## 在线页面

| 项目 | GitHub Pages | 模型数 |
| --- | --- | ---: |
| 电磁学 [1]：电场与电路基础 | [打开交互页面](https://jvzi12-25.github.io/College-Physics-Digital-Models/%E7%94%B5%E7%A3%81%E5%AD%A6%5B1%5D/index.html) | 6 |
| 电磁学 [2]：磁场与电磁波 | [打开交互页面](https://jvzi12-25.github.io/College-Physics-Digital-Models/%E7%94%B5%E7%A3%81%E5%AD%A6%5B2%5D/index.html) | 7 |
| 光学：几何光学与波动光学 | [打开交互页面](https://jvzi12-25.github.io/College-Physics-Digital-Models/%E5%85%89%E5%AD%A6/index.html) | 4 |
| 近代物理学 | [查看项目页面](https://jvzi12-25.github.io/College-Physics-Digital-Models/%E8%BF%91%E4%BB%A3%E7%89%A9%E7%90%86%E5%AD%A6/index.html) | 筹备中 |

[访问项目首页](https://jvzi12-25.github.io/College-Physics-Digital-Models/) 可浏览全部章节。当前共有 **17 个交互模型**。

## 项目说明

- [电磁学 [1] 模型说明](%E7%94%B5%E7%A3%81%E5%AD%A6%5B1%5D/README.md)：库仑力、电场与电势、电容器、高斯定律、带电粒子运动和 RC 充放电。
- [电磁学 [2] 模型说明](%E7%94%B5%E7%A3%81%E5%AD%A6%5B2%5D/README.md)：静磁场、运动电荷、磁介质、电磁感应、RLC 振荡和电磁波。
- [光学模型说明](光学/README.md)：反射与折射、薄透镜成像、双缝干涉和单缝衍射；干涉与衍射图支持固定物理屏幕范围、视野适配和对照曲线。

## 本地运行

从仓库根目录启动项目内置的本地服务：

```powershell
Set-Location -LiteralPath '电磁学[1]'
npm start
```

打开 `http://localhost:4173/` 进入项目首页。页面以静态 HTML、CSS 和 JavaScript 构建；本地服务会将首页和章节页共享资源一并提供。

## 自动化检查

需要安装 Node.js。各模块测试分别在对应目录运行：

```powershell
Set-Location -LiteralPath '电磁学[1]'
npm test
```

```powershell
Set-Location -LiteralPath '电磁学[2]'
node --test js/physics.test.js
```

```powershell
Set-Location -LiteralPath '光学'
npm test
```

## 部署

推送到 `main` 分支后，GitHub Actions 会将项目首页、粒子背景脚本、共享实验室样式和各章节页面部署到 GitHub Pages。部署工作流位于 `.github/workflows/pages.yml`。
