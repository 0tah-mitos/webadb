# WebADB - 浏览器端 Android 调试工具

> 无需安装任何软件，通过 USB 或 WiFi 在浏览器中调试 Android 设备

## 🎯 功能特性

| 功能 | 说明 | 状态 |
|------|------|------|
| 🖥️ Shell 终端 | 远程执行 shell 命令 | ✅ |
| 📁 文件管理 | 浏览设备文件系统 | ✅ |
| 📱 应用管理 | 查看/卸载已安装应用 | ✅ |
| 🖥️ 设备信息 | 查看设备硬件/系统信息 | ✅ |
| 🎬 屏幕投射 | 实时查看设备屏幕 | 🔄 |
| 📋 Logcat | 查看设备日志 | ✅ |
| 📡 网络调试 | ADB 无线配对 + 连接 | ✅ 新增 |

## 📡 网络调试（新增）

支持 Android 11+ 的无线调试功能：

### 两种模式

| 模式 | 说明 | 用途 |
|------|------|------|
| 📶 **无线配对** | 输入 IP + 配对端口 + 配对码 | 首次连接新设备 |
| 🔗 **直接连接** | 输入 IP + 连接端口 | 连接已配对设备 |

### 使用步骤

#### 1. 启动 ADB Bridge 代理

```bash
# 安装依赖（零依赖，只需 Node.js）
# 无需 npm install！

# 启动 Bridge
node bridge.js --port=15555
```

#### 2. 手机端操作

1. 打开 **设置** → **开发者选项** → **无线调试**
2. 开启 **无线调试**
3. 点击 **使用配对码配对设备**
4. 记下 **配对码** 和 **配对端口**

#### 3. 浏览器端操作

1. 打开 [WebADB](https://0tah-mitos.github.io/webadb/)
2. 点击左侧 **网络调试**
3. 在 **无线配对** 标签页输入：
   - 设备 IP 地址
   - 配对端口（不是连接端口！）
   - 6 位配对码
4. 点击 **配对**
5. 配对成功后，切换到 **连接设备** 标签页
6. 输入 **连接端口**（在手机无线调试页面显示）
7. 点击 **连接**

> ⚠️ **配对端口和连接端口不同！** 配对端口是临时的，连接端口是固定的。

## 🔧 技术栈

- **WebUSB API** - 浏览器直接访问 USB 设备
- **WebSocket** - 网络调试通信
- **ADB Protocol** - 纯 JavaScript 实现 ADB 协议
- **Zero Dependencies** - 前端零依赖，Bridge 零依赖
- **Single HTML** - 单文件部署到 GitHub Pages

## 🏗️ 项目结构

```
webadb/
├── index.html    # 完整的 WebADB 应用（单文件）
├── bridge.js    # ADB Bridge 代理服务器（Node.js，零依赖）
└── README.md     # 项目说明
```

## 🔌 ADB Bridge 协议

浏览器通过 WebSocket (`ws://localhost:15555/adb`) 与 Bridge 通信：

### 配对

```json
→ { "action": "pair", "ip": "192.168.1.100", "port": 37653, "code": "123456" }
← { "type": "pair_result", "success": true, "ip": "192.168.1.100", "port": 37653 }
```

### 连接

```json
→ { "action": "connect", "ip": "192.168.1.100", "port": 5555 }
← { "type": "connect_result", "success": true, "ip": "192.168.1.100", "port": 5555 }
```

### Shell 命令

```json
→ { "action": "shell", "command": "getprop ro.product.model" }
← { "type": "shell_output", "command": "getprop ro.product.model", "output": "Pixel 7" }
```

### 断开连接

```json
→ { "action": "disconnect", "ip": "192.168.1.100", "port": 5555 }
← { "type": "disconnect_result", "success": true }
```

### 列出设备

```json
→ { "action": "devices" }
← { "type": "device_list", "devices": [...] }
```

## 🔐 安全说明

- 所有数据传输都在**本地 USB/WiFi 连接**中进行
- Bridge 仅监听 `localhost`，**不对外暴露**
- **不会上传任何数据**到远程服务器
- 代码开源透明，可自行审查

## 📚 参考资料

- [Android Wireless Debugging](https://developer.android.com/studio/command-line/adb#connect-to-a-device-over-wi-fi)
- [Android ADB Protocol](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/master/protocol.txt)
- [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API)
- [ya-webadb](https://github.com/yume-chan/ya-webadb) - 参考 ADB 协议实现

## 📄 License

MIT License

---

**作者：** 0tah-mitos  
**在线体验：** https://0tah-mitos.github.io/webadb/
