import { Suspense } from "react";
import { BookingsBoard } from "@/components/bookings/BookingsBoard";

export default function ManagerBookingsPage() {
  return (
    <Suspense>
      <BookingsBoard role="manager" />
    </Suspense>
  );
}
