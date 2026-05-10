# WebADB - 浏览器端 Android 调试工具

> 无需安装任何软件，通过 USB 在浏览器中调试 Android 设备

## 🎯 功能特性

| 功能 | 说明 | 状态 |
|------|------|------|
| 🖥️ Shell 终端 | 远程执行 shell 命令 | ✅ |
| 📁 文件管理 | 浏览设备文件系统 | ✅ |
| 📱 应用管理 | 查看/卸载已安装应用 | ✅ |
| 🖥️ 设备信息 | 查看设备硬件/系统信息 | ✅ |
| 🎬 屏幕投射 | 实时查看设备屏幕 | 🔄 |
| 📋 Logcat | 查看设备日志 | ✅ |

## 🔧 技术栈

- **WebUSB API** - 浏览器直接访问 USB 设备
- **ADB Protocol** - 纯 JavaScript 实现 ADB 协议
- **Zero Dependencies** - 无需安装任何依赖
- **Single HTML** - 单文件部署到 GitHub Pages

## 🚀 使用方法

### 前提条件
1. **Chrome / Edge 浏览器**（需要 WebUSB 支持）
2. **Android 设备**开启 USB 调试
3. **USB 数据线**连接设备和电脑

### 步骤
1. 打开 [WebADB](https://0tah-mitos.github.io/webadb/)
2. 点击 **连接设备** 按钮
3. 在弹出的设备选择器中选择你的 Android 设备
4. 在手机上点击 **允许 USB 调试**
5. 开始使用！

### 开启 USB 调试
1. 打开 **设置** → **关于手机**
2. 连续点击 **版本号** 7 次（开启开发者模式）
3. 返回 **设置** → **开发者选项**
4. 开启 **USB 调试**

## 🏗️ 项目结构

```
webadb/
├── index.html    # 完整的 WebADB 应用（单文件）
└── README.md     # 项目说明
```

## 🔐 安全说明

- 所有数据传输都在**本地 USB 连接**中进行
- **不会上传任何数据**到服务器
- 基于 WebUSB API，浏览器沙盒隔离
- 代码开源透明，可自行审查

## 🛠️ ADB 协议实现

本项目在 JavaScript 中实现了 ADB 协议的核心消息类型：

| 消息类型 | 代码 | 说明 |
|----------|------|------|
| `CNXN` | `0x4e584e43` | 连接请求 |
| `OPEN` | `0x4e45504f` | 打开流 |
| `OKAY` | `0x59414b4f` | 确认 |
| `CLSE` | `0x45534c43` | 关闭流 |
| `WRTE` | `0x45545257` | 写入数据 |
| `AUTH` | `0x48545541` | 认证 |

## 📚 参考资料

- [Android ADB Protocol](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/master/protocol.txt)
- [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API)
- [ya-webadb](https://github.com/yume-chan/ya-webadb) - 参考 ADB 协议实现

## 📄 License

MIT License

---

**作者：** 0tah-mitos  
**在线体验：** https://0tah-mitos.github.io/webadb/
