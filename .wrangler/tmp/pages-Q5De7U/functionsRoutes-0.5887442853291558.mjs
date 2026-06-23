import { onRequest as __api___path___js_onRequest } from "E:\\无极ETF量化交易系统\\desktop-cat-studio-site\\functions\\api\\[[path]].js"

export const routes = [
    {
      routePath: "/api/:path*",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api___path___js_onRequest],
    },
  ]