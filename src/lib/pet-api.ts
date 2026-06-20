export type ProductTier = "starter_29" | "deluxe_69";

export type OrderStatus =
  | "created"
  | "photos_uploaded"
  | "queued"
  | "generating"
  | "packaging"
  | "ready"
  | "failed";

export interface PetOrder {
  orderId: string;
  status: OrderStatus;
  productTier: ProductTier;
  petName: string;
  species: "cat" | "dog";
  photoCount: number;
  hasPreview: boolean;
  hasPackage: boolean;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  productTier: ProductTier;
  customerName?: string;
  petName?: string;
  species?: "cat" | "dog";
  notes?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_PET_API_BASE ?? "";

async function readApiJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `API request failed: ${response.status}`);
  }
  return payload;
}

export async function createOrder(input: CreateOrderInput): Promise<PetOrder> {
  const response = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await readApiJson<{ order: PetOrder }>(response);
  return payload.order;
}

export async function uploadOrderPhotos(orderId: string, photos: File[]): Promise<PetOrder> {
  let order: PetOrder | null = null;

  for (const photo of photos) {
    const response = await fetch(`${API_BASE}/api/orders/${orderId}/photos`, {
      method: "POST",
      headers: {
        "content-type": photo.type,
        "x-file-name": encodeURIComponent(photo.name),
      },
      body: photo,
    });
    const payload = await readApiJson<{ order: PetOrder }>(response);
    order = payload.order;
  }

  if (!order) {
    throw new Error("missing_photo");
  }

  return order;
}

export async function startGeneration(orderId: string): Promise<PetOrder> {
  const response = await fetch(`${API_BASE}/api/orders/${orderId}/generate`, {
    method: "POST",
  });
  const payload = await readApiJson<{ order: PetOrder }>(response);
  return payload.order;
}

export async function getOrder(orderId: string): Promise<PetOrder> {
  const response = await fetch(`${API_BASE}/api/orders/${orderId}`);
  const payload = await readApiJson<{ order: PetOrder }>(response);
  return payload.order;
}

export function getDownloadUrl(orderId: string): string {
  return `${API_BASE}/api/orders/${orderId}/download`;
}
