import { Suspense } from "react";
import { BookingsBoard } from "@/components/bookings/BookingsBoard";

export default function WaiterBookingsPage() {
  return (
    <Suspense>
      <BookingsBoard role="waiter" />
    </Suspense>
  );
}
