import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  component: AdminWithdrawalsDisabled,
});

function AdminWithdrawalsDisabled() {
  return null;
}
