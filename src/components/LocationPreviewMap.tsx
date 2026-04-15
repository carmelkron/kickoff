type Props = {
  latitude: number;
  longitude: number;
};

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function LocationPreviewMap({ latitude, longitude }: Props) {
  const query = encodeURIComponent(`${latitude},${longitude}`);
  const src = API_KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${query}&zoom=16`
    : `https://maps.google.com/maps?q=${query}&z=16&output=embed`;

  return (
    <div className="relative mb-4 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="pointer-events-none absolute end-4 top-4 z-10 rounded-full bg-white/92 px-3 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-black/5">
          Google Maps
      </div>
      <iframe
        title="Game location map"
        src={src}
        className="aspect-[16/9] w-full border-0 bg-gray-100"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
