// import { useState, useEffect, useMemo, useRef } from "react";
// import { KalmanFilter } from "./KalmanFilter";
// import { motion } from "framer-motion";
// import { useNavigate } from "react-router-dom";
// import { Box, TextField, MenuItem, Button, Paper, Typography, Modal } from "@mui/material";
// import { MapContainer, TileLayer, Marker, useMap, Popup, useMapEvents } from "react-leaflet"; 
// import { OpenStreetMapProvider, GeoSearchControl } from "leaflet-geosearch"; 
// import L from "leaflet";
// import api from "./api"; 
// import Logo from "../assets/Logo.png"; 
// import Welcome from "../components/WelcomeCustomer";
// import { Snackbar, Alert } from "@mui/material";
// import  AIcustomerChatBot from "./AdminAIChatbot/aicustomerChatBot"



// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//     iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
//     iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
//     shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
// });






// // --- Helper: Reverse Geocoding تفصيلي ---
// async function getAddress(lat, lng) {
//     try {
//         const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
//         const data = await res.json();
//         const addr = data.address;
//         return [
//             addr.road,
//             addr.neighbourhood,
//             addr.suburb,
//             addr.city || addr.town || addr.village,
//             addr.state,
//             addr.country
//         ].filter(Boolean).join(", ") || data.display_name || "Unknown location";
//     } catch {
//         return "Unknown location";
//     }
// }





// // --- Helper: Snap to nearest road/building using OSM Overpass API ---
// async function snapToNearestRoad(lat, lng, radius = 50) {
//   try {
//     // Overpass API query to get nearest highway/road within radius meters
//     const query = `
//       [out:json];
//       (
//         way(around:${radius},${lat},${lng})["highway"];
//       );
//       out center 1;
//     `;
//     const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);
//     const res = await fetch(url);
//     const data = await res.json();
//     if (!data.elements || data.elements.length === 0) return { lat, lng }; // no road found

//     // find closest element
//     const closest = data.elements.reduce((prev, curr) => {
//       const dPrev = Math.hypot(prev.lat - lat, prev.lon - lng);
//       const dCurr = Math.hypot(curr.center.lat - lat, curr.center.lon - lng);
//       return dCurr < dPrev ? { lat: curr.center.lat, lng: curr.center.lon } : prev;
//     }, { lat, lng });

//     return closest;
//   } catch (err) {
//     console.error("Snap-to-road error:", err);
//     return { lat, lng };
//   }
// }





// function MapClickHandler({ setPosition, setForm }) {
//   const map = useMap();

//   useMapEvents({
//     click: async (e) => {
//       const coords = e.latlng.wrap();

//       // --- Snap to road ---
//       const snapped = await snapToNearestRoad(coords.lat, coords.lng);

//       setPosition(snapped);

//       const address = await getAddress(snapped.lat, snapped.lng);
//       setForm(prev => ({ ...prev, customer_address: address }));

//       map.flyTo(snapped, 17);
//     }
//   });

//   return null;
// }


// // --- Search Control ---
// function SearchControl({ setPosition, setForm }) {
//     const map = useMap();

//     useEffect(() => {
//         const provider = new OpenStreetMapProvider();
//         const searchControl = new GeoSearchControl({
//             provider, 
//             style: "bar", 
//             showMarker: false, 
//             retainZoomLevel: false,
//             animateZoom: true, 
//             autoClose: true, 
//             searchLabel: "Enter full street or neighborhood name...", 
//             keepResult: true,
//         });

//         map.addControl(searchControl);

//         map.on("geosearch/showlocation", async (result) => {
//             const { x, y, label } = result.location;
//             const coords = { lat: y, lng: x };
//             setPosition(coords);
//             const address = await getAddress(coords.lat, coords.lng);
//             setForm(prev => ({ ...prev, customer_address: address }));
//             map.flyTo(coords, 17);
//         });

//         return () => map.removeControl(searchControl);
//     }, [map, setPosition, setForm]);

//     return null;
// }

// // --- Marker مع سحب لتحديث العنوان ---
// function LocationSelector({ position, setPosition, setForm }) {
//     const markerRef = useRef(null);
//     const eventHandlers = useMemo(() => ({
//   dragend: async () => {
//     const marker = markerRef.current;
//     if (!marker) return;
//     const coords = marker.getLatLng();

//     // Snap to road عند سحب العلامة
//     const snapped = await snapToNearestRoad(coords.lat, coords.lng);
//     setPosition(snapped);

//     const address = await getAddress(snapped.lat, snapped.lng);
//     setForm(prev => ({ ...prev, customer_address: address }));
//   }
// }), [setPosition, setForm]);


//     if (!position) return null;

//     return (
//         <Marker draggable eventHandlers={eventHandlers} position={position} ref={markerRef}>
//             <Popup>Drag to adjust delivery location</Popup>
//         </Marker>
//     );
// }

// // --- Fly to position ---
// function FlyToPosition({ position }) {
//     const map = useMap();
//     useEffect(() => {
//         if (position) map.flyTo(position, 17);
//     }, [position, map]);
//     return null;
// }

// export default function CustomerForm() {
//     const navigate = useNavigate();
//     const [form, setForm] = useState({
//         customer_name: "", customer_phone: "", customer_address: "", type_of_item: "",
//     });
//     const [position, setPosition] = useState(null);
//     const [orderNumber, setOrderNumber] = useState("");
//     const [open, setOpen] = useState(false);
//     const [showWelcome, setShowWelcome] = useState(true);
//     const [isSubmitting, setIsSubmitting] = useState(false);
//     const [notification, setNotification] = useState({
//     open: false,
//     severity: "info", 
//     message: ""
// });

//     const showNotification = (message, severity = "info") => {
//     setNotification(prev => ({
//         ...prev,
//         open: false
//     }));

//     setTimeout(() => {
//         setNotification({
//             open: true,
//             message,
//             severity
//         });
//     }, 150);
// };


//     const itemOptions = ["Electronics", "Clothes", "Food Delivery", "Documents", "Furniture", "Other"];
//     const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

//     const latFilter = new KalmanFilter(0.0001, 0.01);
//     const lngFilter = new KalmanFilter(0.0001, 0.01);

//     // --- Submit Order ---
//     const handleSubmit = async (e) => {
//         e.preventDefault();
//         if (isSubmitting) return;
//         setIsSubmitting(true);

//         if (!position) {
//             alert("❌ Please select location");
//             setIsSubmitting(false);
//             return;
//         }

//         try {
//             const res = await api.post("/public/order/submit", {
//                 customer: {
//                     name: form.customer_name,
//                     phone: form.customer_phone,
//                     address: form.customer_address,
//                     coords: position,
//                 },
//                 type_of_item: form.type_of_item,
//             });
//             setOrderNumber(res.data.order.order_number);
//             setOpen(true);
//             showNotification("✅ Order submitted successfully!", "success");

//         } catch (err) {
//             alert("Failed to submit order");
//             console.error(err);
//         } finally {
//             setIsSubmitting(false);
//         }
//     };

//     useEffect(() => {
//         const timer = setTimeout(() => setShowWelcome(false), 3000);
//         return () => clearTimeout(timer);
//     }, []);

//     return (
//         <>
//         {showWelcome ? <Welcome /> :
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
//             <Paper elevation={6} sx={{ padding: 3, maxWidth: 600, margin: "20px auto", borderRadius: 3 }}>
//                 <img src={Logo} alt="Logo" style={{ width: 90, height: 90, display: "block", margin: "0 auto 8px auto" }} />
//                 <Typography variant="h5" fontWeight={600} textAlign="center" mb={3}>Customer Delivery Request</Typography>

//                 <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
//                     <TextField label="Full Name" name="customer_name" variant="outlined" fullWidth required value={form.customer_name} onChange={handleChange} />
//                     <TextField label="Phone Number" name="customer_phone" type="tel" variant="outlined" fullWidth required value={form.customer_phone} onChange={handleChange} />
//                     <TextField label="Address" name="customer_address" variant="outlined" fullWidth multiline rows={2} required value={form.customer_address} onChange={handleChange} />
//                     <TextField select label="Type of Item" name="type_of_item" variant="outlined" fullWidth required value={form.type_of_item} onChange={handleChange}>
//                         {itemOptions.map((item, idx) => <MenuItem key={idx} value={item}>{item}</MenuItem>)}
//                     </TextField>

//                     <Typography fontWeight={600} mt={2}>Select Delivery Location</Typography>
//                     <Box sx={{ height: "350px", width: "100%", borderRadius: "12px", overflow: "hidden", border: position ? "2px solid green" : "1px solid #ccc" }}>
//                         <MapContainer center={[34.435, 35.836]} zoom={13} style={{ height: "100%", width: "100%" }}>
//                             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
//                             <MapClickHandler setPosition={setPosition} setForm={setForm} />
//                             <SearchControl setPosition={setPosition} setForm={setForm} />
//                             <LocationSelector position={position} setPosition={setPosition} setForm={setForm} />
//                             {position && <FlyToPosition position={position} />}
//                         </MapContainer>
//                     </Box>

//                     {position && form.customer_address &&
//                         <Typography variant="subtitle1" textAlign="center" fontWeight={600} color="primary" mt={1}>
//                             Selected Address: {form.customer_address}
//                         </Typography>
//                     }

//                     <Button
//                         variant="outlined"
//                         onClick={async () => {
//                             if (!navigator.geolocation) return alert("Geolocation not supported");
//                             navigator.geolocation.getCurrentPosition(async (pos) => {
//                                 const filteredLat = latFilter.filter(pos.coords.latitude);
//                                 const filteredLng = lngFilter.filter(pos.coords.longitude);
//                                 const coords = { lat: filteredLat, lng: filteredLng };
//                                 setPosition(coords);
//                                 const address = await getAddress(coords.lat, coords.lng);
//                                 setForm(prev => ({ ...prev, customer_address: address }));

//                                  // Check GPS accuracy
//                                     if (pos.coords.accuracy > 200) {
//                                     showNotification(
//                                         `⚠️ Very low GPS accuracy (±${Math.round(pos.coords.accuracy)}m). Move outside.`,
//                                         "warning"
//                                     );
//                                    } else if (pos.coords.accuracy > 50) {
//                                     showNotification(
//                                         `ℹ️ GPS accuracy is moderate (±${Math.round(pos.coords.accuracy)}m). You may adjust the marker.`,
//                                         "info"
//                                     );
//                                 }
//                                 else {
//                                             showNotification("📍 Location detected accurately", "success");
//                                         }
//                                   }, () => showNotification("GPS permission denied"), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
//                         }}
//                     >
//                         📍 Use My Current Location
//                     </Button>

//                     <Button variant="contained" color="primary" type="submit" sx={{ paddingY: 1.4, borderRadius: 2, fontSize: "1rem" }}>
//                         {isSubmitting ? "Submitting..." : "Submit"}
//                     </Button>
//                 </Box>
//             </Paper>

//             <Modal open={open} onClose={() => setOpen(false)}>
//                 <Paper sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", padding: 4, maxWidth: 400, textAlign: "center", borderRadius: 2 }}>
//                     <Typography variant="h6" mb={2}>Order Submitted!</Typography>
//                     <Typography variant="h5" mb={3} sx={{ fontWeight: "bold" }}>{orderNumber}</Typography>
//                     <Button variant="contained" onClick={() => navigate("/TrackingForm", { state: { orderNumber } })}>Track Order</Button>
//                     <Button variant="outlined" color="secondary" sx={{ ml: 1 }} onClick={() => setOpen(false)}>Close</Button>
//                 </Paper>
//             </Modal>
//         </motion.div>
//         }

//         <Snackbar
//             open={notification.open}
//             autoHideDuration={5000}
//             onClose={() => setNotification(prev => ({ ...prev, open: false }))}
//             anchorOrigin={{ vertical: "top", horizontal: "center" }}
//         >
//             <Alert
//                 severity={notification.severity}
//                 onClose={() => setNotification(prev => ({ ...prev, open: false }))}
//                 sx={{ width: "100%" }}
//                 variant="filled"
//             >
//                 {notification.message}
//             </Alert>
//         </Snackbar>

//         <AIcustomerChatBot /> 
//         </>
//     );
// }


import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  Box, TextField, MenuItem, Button, Paper, Typography, 
  Modal, CircularProgress, Snackbar, Alert 
} from "@mui/material";

// --- Internal Kalman Filter Logic (to avoid external file error) ---
class KalmanFilter {
  constructor(q = 0.0001, r = 0.01) {
    this.q = q; // process noise covariance
    this.r = r; // measurement noise covariance
    this.x = null; // estimated signal without noise
    this.p = 1; // estimation error covariance
  }

  filter(z) {
    if (this.x === null) {
      this.x = z;
      return z;
    }
    this.p = this.p + this.q;
    const k = this.p / (this.p + this.r);
    this.x = this.x + k * (z - this.x);
    this.p = (1 - k) * this.p;
    return this.x;
  }
}

// --- Dynamic Dependency Loader (Leaflet & GeoSearch) ---
const loadExternalAssets = () => {
  return new Promise((resolve) => {
    if (window.L) {
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      // Setup Leaflet Icons
      delete window.L.Icon.Default.prototype._getIconUrl;
      window.L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      resolve();
    };
    document.body.appendChild(script);
  });
};

// --- Mock Components for Assets missing in this environment ---
const LogoPlaceholder = () => (
  <Box sx={{ width: 80, height: 80, bgcolor: '#0ABE51', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', color: 'white', fontWeight: 'bold' }}>
    LOGO
  </Box>
);

// --- Helpers (Geocoding) ---
async function getAddress(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
    const data = await res.json();
    return data.display_name || "الموقع المختار";
  } catch { return "فشل في تحديد العنوان"; }
}

export default function App() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_address: "", type_of_item: "" });
  const [position, setPosition] = useState(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [open, setOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [notification, setNotification] = useState({ open: false, severity: "info", message: "" });

  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const latFilter = useMemo(() => new KalmanFilter(), []);
  const lngFilter = useMemo(() => new KalmanFilter(), []);

  useEffect(() => {
    loadExternalAssets().then(() => setAssetsLoaded(true));
    const timer = setTimeout(() => setShowWelcome(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (assetsLoaded && position && mapRef.current) {
      if (!mapRef.current._leaflet_initialized) {
        const map = window.L.map('map-container').setView([position.lat, position.lng], 15);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        markerRef.current = window.L.marker([position.lat, position.lng], { draggable: true }).addTo(map);
        
        markerRef.current.on('dragend', async () => {
          const newPos = markerRef.current.getLatLng();
          const addr = await getAddress(newPos.lat, newPos.lng);
          setPosition({ lat: newPos.lat, lng: newPos.lng });
          setForm(f => ({ ...f, customer_address: addr }));
        });

        mapRef.current._leaflet_initialized = true;
      } else {
        markerRef.current.setLatLng([position.lat, position.lng]);
      }
    }
  }, [assetsLoaded, position]);

  const showNotification = (message, severity = "info") => {
    setNotification({ open: true, message, severity });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!position) return showNotification("الرجاء تحديد الموقع على الخريطة", "error");

    setIsSubmitting(true);
    try {
      // محاكاة طلب API لتجنب أخطاء الاتصال في العرض
      await new Promise(resolve => setTimeout(resolve, 1500));
      const fakeOrderNum = "TAW-" + Math.floor(100000 + Math.random() * 900000);
      
      setOrderNumber(fakeOrderNum);
      setOpen(true);
      showNotification("✅ تم إرسال الطلب بنجاح!", "success");
    } catch (err) {
      showNotification("❌ فشل في إرسال الطلب", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToTracking = () => {
    // حل جذري للشاشة السوداء: إغلاق المودال أولاً ثم الانتظار قليلاً قبل الـ Navigate
    setOpen(false);
    setTimeout(() => {
      // نقوم باستخدام التوجيه مع تمرير البيانات
      navigate("/TrackingForm", { state: { orderNumber }, replace: true });
    }, 150);
  };

  if (showWelcome) return (
    <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0ABE51' }}>أهلاً بك في توصيلة</Typography>
    </Box>
  );

  return (
    <Box sx={{ pb: 5, bgcolor: '#f8f9fa', minHeight: '100vh' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Paper elevation={4} sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 4, borderRadius: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <LogoPlaceholder />
            <Typography variant="h5" fontWeight={800} mt={2}>طلب توصيل جديد</Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField 
                label="الاسم الكامل" 
                fullWidth 
                required 
                value={form.customer_name}
                onChange={(e) => setForm({...form, customer_name: e.target.value})}
              />
              <TextField 
                label="رقم الهاتف" 
                fullWidth 
                required 
                value={form.customer_phone}
                onChange={(e) => setForm({...form, customer_phone: e.target.value})}
              />
              <TextField 
                label="العنوان بالتفصيل" 
                fullWidth 
                multiline 
                rows={2} 
                required 
                value={form.customer_address}
                onChange={(e) => setForm({...form, customer_address: e.target.value})}
              />
              
              <TextField 
                select 
                label="نوع الشحنة" 
                fullWidth 
                required 
                value={form.type_of_item}
                onChange={(e) => setForm({...form, type_of_item: e.target.value})}
              >
                {["إلكترونيات", "ملابس", "طعام", "وثائق", "أثاث", "أخرى"].map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </TextField>

              <Typography variant="subtitle2" fontWeight="bold">📍 حدد موقع التسليم</Typography>
              <Box 
                id="map-container" 
                ref={mapRef}
                sx={{ height: 300, borderRadius: 2, bgcolor: '#eee', border: '1px solid #ddd' }}
              />

              <Button 
                variant="outlined" 
                onClick={() => {
                  navigator.geolocation.getCurrentPosition(async (pos) => {
                    const lat = latFilter.filter(pos.coords.latitude);
                    const lng = lngFilter.filter(pos.coords.longitude);
                    const addr = await getAddress(lat, lng);
                    setPosition({ lat, lng });
                    setForm(f => ({ ...f, customer_address: addr }));
                  });
                }}
              >
                استخدام موقعي الحالي 🎯
              </Button>

              <Button 
                type="submit" 
                variant="contained" 
                disabled={isSubmitting}
                sx={{ py: 1.5, bgcolor: '#0ABE51', '&:hover': { bgcolor: '#089d42' } }}
              >
                {isSubmitting ? <CircularProgress size={24} color="inherit" /> : "تأكيد الطلب"}
              </Button>
            </Box>
          </form>
        </Paper>
      </motion.div>

      {/* Modal النجاح المحسن */}
      <Modal open={open} onClose={() => !isSubmitting && setOpen(false)}>
        <Paper sx={{ 
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", 
          p: 4, width: 340, textAlign: "center", borderRadius: 4
        }}>
          <Typography variant="h6" color="success.main" fontWeight="bold">تم استلام طلبك!</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>رقم التتبع الخاص بك هو:</Typography>
          <Typography variant="h4" fontWeight={900} sx={{ my: 2, color: '#1a1a1a' }}>{orderNumber}</Typography>
          
          <Button variant="contained" fullWidth size="large" onClick={handleGoToTracking} sx={{ borderRadius: 2 }}>
            تتبع الطلب الآن
          </Button>
        </Paper>
      </Modal>

      <Snackbar open={notification.open} autoHideDuration={4000} onClose={() => setNotification({ ...notification, open: false })}>
        <Alert severity={notification.severity} variant="filled">{notification.message}</Alert>
      </Snackbar>
    </Box>
  );
}