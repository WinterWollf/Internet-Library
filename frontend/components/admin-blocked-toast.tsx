"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

export default function AdminBlockedToast() {
  const params = useSearchParams()

  useEffect(() => {
    if (params.get("blocked") === "admin") {
      toast.error("Access denied — admin only.")
    }
  }, [params])

  return null
}
