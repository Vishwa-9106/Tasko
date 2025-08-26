import { Home, Utensils, Shirt, Wrench } from 'lucide-react';

// Centralized service categories used across the app
// Note: "Cleaning" removed. Added "Home Cleaning" and "Bathroom Cleaning".
export const CATEGORIES = [
  'Home Cleaning',
  'Dishwashing',
  'Laundry',
  'Cooking',
  'Cloud Kitchen',
  'Baby Sitting',
  'Gardening',
  'Maintenance'
];

// Icon mapping for categories
export const ICON_MAP = {
  'Home Cleaning': Home,
  'Bathroom Cleaning': Home,
  'Dishwashing': Utensils,
  'Laundry': Shirt,
  'Cooking': Utensils,
  'Cloud Kitchen': Utensils,
  'Baby Sitting': Home,
  'Gardening': Home,
  'Maintenance': Wrench
};

// Predefined options for Service Name when category is "Home Cleaning"
export const HOME_CLEANING_OPTIONS = [
  'Dusting & Wiping',
  'Floor Cleaning',
  'Kitchen Cleaning',
  'Bathroom Cleaning',
  'Carpet & Upholstery Cleaning',
  'Window & Glass Cleaning',
  'Deep Cleaning',
  'Disinfection & Sanitization',
  'Balcony & Outdoor Area Cleaning',
  'Appliance Cleaning'
];

// Predefined options for Service Name when category is "Laundry"
export const LAUNDRY_OPTIONS = [
  'Normal Wash',
  'Hand Wash',
  'Machine Wash',
  'Dry Cleaning',
  'Steam Ironing / Pressing',
  'Stain Removal',
  'Whites Care',
  'Fabric Softening',
  'Folding & Packing',
  'Express / Same-Day Service'
];

// Predefined options for Service Name when category is "Dishwashing"
export const DISHWASHING_OPTIONS = [
  'Basic Dishwashing',
  'Heavy Utensil Cleaning',
  'Grease & Oil Removal',
  'Delicate Dish Care',
  'Commercial Dishwashing',
  'Deep Sanitization',
  'Eco-Friendly Dishwashing',
  'On-Site Dishwashing',
  'Pickup & Drop Service'
];

// Predefined options for Service Name when category is "Cooking"
export const COOKING_OPTIONS = [
  'Meals (Sappaadu)',
  'Tiffin Items',
  'Non-Veg Specials',
  'Variety Rice',
  'Biryani',
  'Snacks & Sweets'
];

// Predefined options for Service Name when category is "Gardening"
export const GARDENING_OPTIONS = [
  'Planting & Seeding',
  'Watering & Maintenance',
  'Weeding & Lawn Care',
  'Fertilizing & Soil Care',
  'Garden Cleaning'
];

// Predefined options for Service Name when category is "Baby Sitting"
export const BABYSITTING_OPTIONS = [
  'Infant Care',
  'Toddler Care',
  'After-School Care',
  'Full-Day Babysitting',
  'Night-Time Babysitting'
];
