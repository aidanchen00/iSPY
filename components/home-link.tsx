'use client'

import Link from 'next/link'
import { Eye } from 'lucide-react'

export default function HomeLink() {
  return (
    <Link 
      href="/" 
      className="flex items-center gap-2 group"
    >
      <div className="w-8 h-8 bg-mint rounded-lg flex items-center justify-center shadow-lg shadow-mint/20 transition-transform duration-200 group-hover:scale-105">
        <Eye className="w-4 h-4 text-gray-dark" />
      </div>
      <span className="text-xl font-bold text-white tracking-tight">
        KIMSTORE
      </span>
    </Link>
  )
}
