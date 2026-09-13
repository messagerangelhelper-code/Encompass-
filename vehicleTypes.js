import { Car, Users, Truck, Package } from "lucide-react";

export const VEHICLE_TYPES = [
  { id: "standard", name: "Standard", icon: Car, note: "Everyday rides", multiplier: 1 },
  { id: "xl", name: "XL", icon: Users, note: "Up to 6 seats", multiplier: 1.5 },
  { id: "truck", name: "Truck", icon: Truck, note: "Hauling & large items", multiplier: 2 },
  { id: "cargo", name: "Cargo Van", icon: Package, note: "Moving & deliveries, no seats needed", multiplier: 2.2 },
];
