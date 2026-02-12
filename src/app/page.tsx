export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-void-black">
      <main className="flex flex-col items-center gap-8 px-6 text-center">
        <h1 className="bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-7xl">
          ozskr.ai
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Solana AI Agent Platform. Create, manage, and deploy autonomous AI
          agents on-chain.
        </p>
        <div className="flex gap-4">
          <div className="rounded-full bg-gradient-to-r from-solana-purple to-solana-green p-px">
            <div className="rounded-full bg-void-black px-6 py-2.5">
              <span className="bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-sm font-medium text-transparent">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
