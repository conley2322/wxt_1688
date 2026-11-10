@echo off
chcp 65001 >nul
title ALOCS-1688 一键升级
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-windows.ps1"
