import { Suspense } from "react";
import { BillingBoard } from "./BillingBoard";

export default function BillingPage() {
  return (
    <Suspense>
      <BillingBoard />
    </Suspense>
  );
}
