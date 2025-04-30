"use client";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}

const base = "px-4 py-2 rounded focus:outline-none transition disabled:opacity-50";
const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-700 text-white hover:bg-gray-800",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export default function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
