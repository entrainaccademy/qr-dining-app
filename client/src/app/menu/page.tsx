import { Suspense } from "react";
import { MenuView, MenuSkeleton } from "@/components/menu/MenuView";

// useSearchParams (the room token) needs a Suspense boundary for production builds.
export default function MenuPage() {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <MenuView />
    </Suspense>
  );
}
