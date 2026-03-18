~~~bash
# Steam Data Insight: High-Availability Full-Stack Platform

## 1. 项目概述
本项目是一个基于前后端分离架构的 Steam 玩家数据洞察平台。系统不仅实现了对 Steam 平台海量游戏数据、玩家成就与个人资料的深度整合与可视化，更在基础设施层采用了企业级的云原生与高可用部署方案。

通过引入 Keepalived 与 Nginx 组成高可用网关接入层，结合 Docker 容器化封装全栈 Node.js 业务应用，本项目构建了一个具备四层/七层负载均衡、自动容灾切换以及公网穿透访问能力的微型集群。

## 2. 架构设计

系统整体采用双节点双活（Active-Active）架构，彻底消除单点故障（SPOF），确保服务的高可用性与网络流量的平滑分发。

### 2.1 拓扑结构

```text
                  [ 公网入口 (HTTPS / 穿透隧道) ]
                                |
             +------------------+------------------+
             |         VIP: 172.25.254.200         |
             |      (Keepalived 虚拟 IP 抢占)      |
             +------------------+------------------+
                                |
             +------------------+------------------+
             |      Nginx L7 反向代理 & 负载均衡     |
             |         (Round Robin 轮询)          |
             +------------------+------------------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
    [ Master 节点 ]                        [ Node2 节点 ]
    IP: 172.25.254.111                    IP: 172.25.254.112
             |                                     |
    +--------+--------+                   +--------+--------+
    | Docker 容器     |                   | Docker 容器     |
    | Port: 8080      |                   | Port: 8080      |
    | BFF 网关服务    |                   | BFF 网关服务    |
    | (Node.js/React) |                   | (Node.js/React) |
    +-----------------+                   +-----------------+
~~~

### 2.2 核心特性

- **高可用容灾 (HA)**：基于 VRRP 协议实现 VIP 秒级漂移，任意单计算节点宕机均可实现无感知的故障转移。
- **BFF 代理网关**：采用 Node.js 构建 Backend For Frontend 层，阻断跨域限制，隐藏核心 API 凭证，并对上游接口数据进行清洗与降级处理。
- **防御性编程 (Defensive Fetching)**：后端封装严格的异常捕获与拦截器，避免因第三方 API 返回非预期数据格式（如 HTML 错误页）导致的 Node.js 进程雪崩。

## 3. 技术栈

- **前端视图层**：React 18, Vite, TailwindCSS
- **后端服务层**：Node.js 18, Express.js
- **基础设施与运维**：Docker, Nginx, Keepalived
- **系统环境**：Linux (CentOS / Debian)

## 4. 部署与交付指引

本项目严格遵循构建与运行分离的持续集成原则，通过精简的容器化方案提供一键部署能力。

### 4.1 前置要求

- 目标服务器已安装并启动 Docker 引擎。
- 已获取有效的 `STEAM_API_KEY`。

### 4.2 镜像构建规范

为避免跨平台编译引发的底层 C++ 绑定异常（Native Binding 缺失），本项目实行宿主机前端编译与容器后端运行分离的策略。

Bash



```bash
# 1. 宿主机环境编译前端静态资源
npm run build

# 2. 构建纯净态生产镜像 (Dockerfile 内已配置 --omit=dev 剔除构建依赖)
docker build -t steam-insight:v1 .
```

### 4.3 容器实例运行

Bash



```bash
docker run -d \
  --name steam-frontend \
  --restart always \
  -p 8080:3000 \
  -e STEAM_API_KEY="YOUR_STEAM_API_KEY_HERE" \
  steam-insight:v1
```

## 5. SRE 工程实践与排错记录

在项目的容器化与集群化演进过程中，重点解决并沉淀了以下工程痛点：

### 5.1 Docker 跨平台底层编译异常修复

- **问题描述**：在 Windows 环境向 Linux 容器复制上下文时，`package-lock.json` 错误锁定了宿主机架构的底层二进制文件（如 esbuild），导致容器内构建触发 `Cannot find native binding`。
- **治理方案**：引入 `.dockerignore` 严格管控上下文范围；重构 Dockerfile 逻辑，剥离开发依赖（`npm install --omit=dev`），确保 Linux 容器获取纯正的对应架构基础库，同时将镜像体积缩减了 40% 以上。

### 5.2 状态同步与流量分发

针对双活集群中的版本一致性问题，采用标准的镜像导出（`docker save`）与跨节点安全传输（`scp`）完成集群间的交付同步。Nginx 代理层通过剥离真实 IP（`X-Real-IP` 头透传），确保后端业务日志链路的完整性与可追溯性。

## 6. 开源协议

本项目采用 MIT License。