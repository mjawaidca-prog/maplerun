export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-sm text-center space-y-6">
        <span className="text-5xl" role="img" aria-label="Mailbox">
          📬
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A magic link has been sent to your email address.
          <br />
          Click the link to sign in to MapleRun.
        </p>
        <p className="text-xs text-muted-foreground">
          Didn&apos;t receive it? Check your spam folder, or{" "}
          <a
            href="/sign-in"
            className="underline underline-offset-2 hover:text-foreground"
          >
            try again
          </a>
          .
        </p>
      </div>
    </div>
  );
}
