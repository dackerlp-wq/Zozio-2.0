"use client";

import dynamic from "next/dynamic";

const AdminMapPicker = dynamic(
  () => import("./admin-map-picker").then((m) => m.AdminMapPicker),
  {
    ssr: false,
    loading: () => <div className="h-[420px] w-full animate-pulse rounded-2xl bg-cream-warm" />,
  },
);

export function AdminMapPickerLoader({ onChanged }: { onChanged?: () => void }) {
  return <AdminMapPicker onChanged={onChanged} />;
}
