import { Car, Users, Truck, Package, Box } from "lucide-react";
export const VEHICLE_TYPES = [
  { id: "standard", name: "Standard", icon: Car, note: "Everyday rides", multiplier: 1 },
  { id: "xl", name: "XL", icon: Users, note: "Up to 6 seats", multiplier: 1.5 },
  { id: "truck", name: "Pickup Truck", icon: Truck, note: "Hauling & large items", multiplier: 2 },
  { id: "cargo", name: "Cargo Van", icon: Package, note: "Moving & deliveries, no seats needed", multiplier: 2.2 },
  { id: "boxtruck", name: "Box Truck", icon: Truck, note: "Furniture, appliances & big loads", multiplier: 3 },
  { id: "package", name: "Packages", icon: Box, note: "Send a package or store pickup", multiplier: 1.2 },
];
