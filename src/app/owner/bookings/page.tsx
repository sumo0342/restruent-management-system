import { Suspense } from "react";
import { BookingsBoard } from "@/components/bookings/BookingsBoard";

export default function OwnerBookingsPage() {
  return (
    <Suspense>
      <BookingsBoard role="owner" />
    </Suspense>
  );
}
