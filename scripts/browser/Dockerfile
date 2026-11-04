FROM node:24.11.1-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
WORKDIR /qa
RUN npm install --prefix /qa --no-audit --no-fund --save-exact playwright-core@1.64.1
ENV FF_PLAYWRIGHT_MODULE=/qa/node_modules/playwright-core FF_BROWSER_EXECUTABLE=/usr/bin/chromium
WORKDIR /workspace
ENTRYPOINT ["node"]
