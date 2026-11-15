# 发行签名与固定扩展 ID

从 **v1.2.3** 起，ALOCS-1688 的 Chrome ZIP 和 CRX 统一使用 **`omlkcfhmicbbekplnfclgnpldachonoo`**。这沿用了 v1.2.2 CRX 的签名身份。旧 ZIP 的 ID `jfmjpidelkddbbfdjaopimehhconoekm` 属于旧身份；首次切换会使用新库，同一浏览器配置下之后的同 ID 更新继续使用原来的 IndexedDB。需要保留旧身份的数据时，可从旧版导出再导入新版。

## 在 GitHub 上打包

原始 PEM 存在 GitHub 仓库的 **Settings → Secrets and variables → Actions → `ALOCS_CRX_SIGNING_KEY`**。公司和家里的电脑都只需要 GitHub 仓库权限。打包任务会临时把原始私钥写到运行器，签名后删除临时文件。

1. 提升 `wxt/package.json` 的版本并同步 lockfile，再把待发布提交推到 GitHub。
2. 给待打包的提交打 `package-v<版本>` 标签并推送，例如 `git tag package-v1.2.3`、`git push origin package-v1.2.3`。也可以在工作流进入默认分支后，在 **Actions → Package ALOCS-1688 → Run workflow** 选择待打包分支。
3. 打开 Actions 对应运行，从 `alocs-1688-chrome` 下载两种包。确认后把内部的 `alocs-1688-standalone-<版本>-chrome.zip` 和 `alocs-1688-standalone-<版本>-chrome.crx` 上传到 GitHub Release。

WXT 在写 ZIP 前校验生成的 `manifest.json` 公钥和签名私钥导出的公钥。两者必须都算出固定 ID；缺密钥或任一 ID 不符，禁止打包。CRX 使用同一把私钥签名 ZIP。保持 `wxt.config.js` 的 `key` 和 `chromium-release.js` 的发布 ID 固定。

## 私钥保管和恢复

- 所有发行包必须使用 `ALOCS_CRX_SIGNING_KEY` 保存的原始私钥。仓库、Markdown、运行日志和 Release 只可包含公钥、配置和成品，禁止提交或上传 PEM。
- Actions Secret 可以用于签名，GitHub 不提供下载原值的入口。需要恢复或更换仓库时，从独立的加密备份还原原私钥，再重新设置同名 Secret。不要用新生成的密钥替换它。
- 开发只需 `npm run build`，不需要签名私钥。正式 ZIP/CRX 从 GitHub Actions 下载，可在任一电脑发起打包。

用户按既有安装方式更新。加载已解压的用户，保留原目录和 `manifest.json` 的公钥，覆盖文件后重载原扩展。CRX 是否能安装或覆盖由浏览器规则决定。
