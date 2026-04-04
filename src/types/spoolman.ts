export interface IVendor {
  id: number;
  registered: string;
  name: string;
  comment: string | null;
  empty_spool_weight: number | null;
  external_id: string | null;
  extra: Record<string, string>;
}

export interface IFilament {
  id: number;
  registered: string;
  name: string | null;
  vendor: IVendor | null;
  material: string | null;
  price: number | null;
  density: number;
  diameter: number;
  weight: number | null;
  spool_weight: number | null;
  article_number: string | null;
  comment: string | null;
  settings_extruder_temp: number | null;
  settings_bed_temp: number | null;
  color_hex: string | null;
  color_hexes: string[] | null;
  external_id: string | null;
  extra: Record<string, string>;
}

export interface ISpool {
  id: number;
  registered: string;
  first_used: string | null;
  last_used: string | null;
  filament: IFilament;
  price: number | null;
  remaining_weight: number | null;
  initial_weight: number | null;
  spool_weight: number | null;
  used_weight: number;
  remaining_length: number | null;
  used_length: number;
  location: string | null;
  comment: string | null;
  archived: boolean;
  extra: Record<string, string>;
}
