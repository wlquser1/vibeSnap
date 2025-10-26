# 📸 VibeSnap

> 专为 AI 开发者设计的智能代码快照工具

**VibeSnap** 是一个桌面应用程序，帮助开发者在使用 AI 工具修改代码时，自动追踪所有更改并轻松回退到任意历史版本。

## ✨ 核心功能

### 🎯 自动快照
- **自动监听** 项目文件夹中的文件变化
- **智能防抖** 文件停止修改后自动创建快照
- **Git 集成** 自动初始化 Git 仓库（如未初始化）

### ⏱️ 时光倒流
- **可视化时间线** 所有快照按时间顺序显示
- **一键回退** 点击任意快照，瞬间恢复到该版本
- **安全确认** 回退前二次确认，防止误操作

### 🤖 AI 友好
- **读取 AI 日志** 从 AI 工具的日志文件中提取指令作为提交信息
- **智能提交** 自动为每次快照生成清晰的提交记录
- **零 Git 操作** 无需手动输入 Git 命令

## 🚀 快速开始

### 环境要求

- **Node.js** (v18+)
- **Rust** (最新稳定版)
- **npm** 或 yarn

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <你的仓库地址>
   cd vibesnap
   ```

2. **安装 Rust** (如果未安装)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

3. **安装依赖**
   ```bash
   # 安装根目录依赖
   npm install
   
   # 安装前端依赖
   cd src
   npm install
   cd ..
   ```

### 开发模式

```bash
npm run dev
```

这将启动开发服务器，自动打开桌面应用窗口。

### 构建生产版本

```bash
npm run build
```

构建产物位于：
- **Mac**: `src-tauri/target/release/bundle/macos/vibesnap.app`
- **DMG**: `src-tauri/target/release/bundle/dmg/vibesnap_xxx.dmg`

## 💡 使用场景

### 场景 1: AI 辅助开发
```
让 AI 改代码 → 自动创建快照 → 
改坏了？ → 点击回退 → 回到上一个版本 ✅
```

### 场景 2: 多方案实验
```
尝试方案 A → 快照
尝试方案 B → 快照  
尝试方案 C → 快照
对比效果，保留最佳的 ✅
```

### 场景 3: 学习新技术
```
每次实验前快照 → 
记录每个学习节点 → 
方便复盘和回顾 ✅
```

## 🛠️ 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Rust (Tauri Framework)
- **平台**: 跨平台桌面应用 (Mac / Windows / Linux)

## 📁 项目结构

```
vibesnap/
├── src/                    # React 前端
│   ├── src/
│   │   ├── App.tsx         # 主应用组件
│   │   ├── MainLayout.tsx  # 主布局
│   │   ├── AutoWatcher.tsx     # 自动监听组件
│   │   ├── SnapshotTimeline.tsx # 时间线组件
│   │   └── ...
│   ├── package.json        # 前端依赖
│   └── vite.config.ts      # Vite 配置
├── src-tauri/              # Tauri 后端
│   ├── src/
│   │   ├── lib.rs          # Rust 核心逻辑
│   │   └── main.rs         # Rust 入口
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
└── package.json             # 项目根依赖
```

## 🎨 界面预览

**双栏布局设计**：
- 📸 **左侧**：快照历史列表（时间线）
- 📊 **右侧**：当前快照详情和回退操作

**三大标签页**：
- 📸 快照管理 - 创建、查看、回退快照
- ⚙️ 自动监听 - 配置自动快照功能
- 📊 项目状态 - 查看项目 Git 状态

## 🔧 主要特性

### ✅ React + TypeScript 前端
- 类型安全
- 热重载开发体验
- 现代化 UI 设计

### ✅ Rust 后端
- 高性能文件监听
- 轻量级 Git 操作
- 跨平台支持

### ✅ Tauri 框架
- 原生性能
- 小体积应用
- 安全性高

## 📝 使用说明

### 创建快照

1. 打开 VibeSnap
2. 选择项目文件夹
3. 点击"📸 保存快照"按钮
4. 输入 AI 指令或提示词
5. 完成 ✅

### 自动监听

1. 打开"⚙️ 自动监听"标签页
2. 配置日志文件路径（可选）
3. 设置防抖时间（默认 2 秒）
4. 点击"🚀 启动自动监听"
5. 系统将自动追踪所有文件变化 ✅

### 回退版本

1. 在快照时间线中点击任意快照
2. 查看右侧详情
3. 点击"🔄 回退"按钮
4. 确认操作
5. 完成回退 ✅

## ⚠️ 注意事项

- 回退操作会**永久删除**当前未提交的修改
- 确保重要修改已保存或提交
- 建议定期创建手动快照作为备份

## 🐛 故障排除

### 问题 1: 构建失败
```
解决方案：
1. 检查 Rust 版本：rustc --version
2. 清理缓存：cd src-tauri && cargo clean
3. 重新构建：npm run build
```

### 问题 2: 无法监听文件变化
```
解决方案：
1. 检查项目路径是否正确
2. 确认有文件修改权限
3. 查看终端错误信息
```

### 问题 3: Git 操作失败
```
解决方案：
1. 确保已安装 Git
2. 检查项目路径是否正确
3. 查看具体错误信息
```

## 📄 License

MIT License

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [React](https://react.dev/) - UI 框架
- [Vite](https://vitejs.dev/) - 构建工具

---

**VibeSnap** - 让 AI 开发更可控 🚀
