import Logo from '../components/Logo'

export default function CheckEmail() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 text-center">
      <div className="flex flex-col items-center">
        <Logo size={34} className="mb-8" />
        <h1 className="font-display text-2xl font-medium text-navyDeep mb-3">Check your inbox</h1>
        <p className="text-muted max-w-sm">
          We sent you a confirmation link. Click it to activate your account and start your trial.
        </p>
      </div>
    </div>
  )
}
