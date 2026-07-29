import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function LandingPage() {
  // env 未配置时直接展示落地页（不查登录态）
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="px-5 py-6 pb-16">
      {/* 顶栏 */}
      <header className="flex items-center justify-between h-12 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚩</span>
          <span className="text-lg font-bold">反旗</span>
        </div>
      </header>

      {/* H1 + 副标题 */}
      <section className="mb-8">
        <h1 className="text-h1 mb-3">
          立 flag 的人千千万
          <br />
          倒 flag 的你一个
        </h1>
        <p className="text-body">
          一个嘴毒心软的 AI 损友
          <br />
          盯你把事做完
        </p>
      </section>

      {/* 演示卡 */}
      <section className="mb-8">
        <div className="card-ai flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-brand-200 flex items-center justify-center text-2xl shrink-0">
            😏
          </div>
          <div>
            <p className="text-sm font-medium text-ink-800 mb-1">损友</p>
            <p className="text-body leading-relaxed">
              哟，今天又没早起？闹钟是摆设吗 😂
            </p>
          </div>
        </div>
      </section>

      {/* 主 CTA */}
      <section className="mb-2">
        <Link href="/login" className="btn-primary">
          立 my 第一个 flag
        </Link>
      </section>
      <p className="text-muted text-center mb-10">不用注册，邮箱直接开始 →</p>

      {/* 怎么玩 */}
      <section className="mb-8">
        <h2 className="text-h2 mb-3">▎它怎么玩</h2>
        <ol className="space-y-3 text-body">
          <li>
            <span className="font-semibold text-ink-800">① 设个目标</span>
            <br />
            早起 / 健身 / 学习
          </li>
          <li>
            <span className="font-semibold text-ink-800">② 每天打卡</span>
            <br />
            做到了它夸你，没做它损你
          </li>
          <li>
            <span className="font-semibold text-ink-800">③ 7 天看报告</span>
            <br />
            看看你是真自律还是假努力
          </li>
        </ol>
      </section>

      {/* 差异化 */}
      <section className="mb-10">
        <h2 className="text-h2 mb-3">▎它和别的打卡 app 有啥不同</h2>
        <ul className="space-y-2 text-body">
          <li>· 别的 app 温柔鼓励</li>
          <li>· 它会真的损你（可关闭）</li>
          <li>· 但你做到了它夸得比谁都狠</li>
        </ul>
      </section>

      {/* 底部 CTA */}
      <section>
        <Link href="/login" className="btn-primary">
          立 my 第一个 flag
        </Link>
      </section>
    </main>
  );
}
