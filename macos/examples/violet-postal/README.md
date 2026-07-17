# 紫罗兰 · 邮政事务所

此目录公开主题参数，不包含背景图或人物素材。请仅使用你有权使用的图片。

## 准备背景图

将自己的 JPG 图片命名为 `background.jpg`，放到本目录，与
`theme.json` 保持同级。缺少图片时主题无法安装或切换。

## 安装到本机主题库

先安装兼容的 Codex Dream Skin Studio 1.3.0，然后在本目录执行：

```bash
THEME_DIR="$HOME/Library/Application Support/CodexDreamSkinStudio/themes/custom-violet-postal"
mkdir -p "$THEME_DIR"
cp theme.json background.jpg "$THEME_DIR/"
~/.codex/codex-dream-skin-studio/scripts/switch-theme-macos.sh \
  --id custom-violet-postal
```

模板保留浅色外观、左侧安全区、焦点位置、邮政装饰和动画强度。
`background.jpg` 不应提交到 Git。
