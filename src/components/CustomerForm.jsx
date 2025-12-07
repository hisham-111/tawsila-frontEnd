import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Box, TextField, MenuItem, Button, Paper, Typography, Modal } from "@mui/material";
import { MapContainer, TileLayer, Marker, useMap, Popup, useMapEvents } from "react-leaflet"; 
import { OpenStreetMapProvider, GeoSearchControl, EsriProvider } from "leaflet-geosearch"; // تأكد من استيراد EsriProvider
import L from "leaflet";
import api from "./api"; 
import Logo from "../assets/Logo.png"; 

// --- إصلاح أيقونات Leaflet ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});


// 1. مكون للتعامل مع النقرات على الخريطة (تم فرض تصحيح الإحداثيات)
function MapClickHandler({ setPosition, setForm }) {
    const map = useMap(); 
    
    useMapEvents({
        click(e) {
            // 💡 التصحيح: استخدام دالة wrap() لـ Leaflet لضمان أن خط الطول بين -180 و 180
            const correctedLatLng = e.latlng.wrap(); 

            console.log("✅ Final Click Coords:", correctedLatLng); // للتأكد في الكونسول
            
            setPosition(correctedLatLng);
            // عند النقر، نحدث العنوان ونحرك الخريطة
            setForm((prev) => ({ ...prev, customer_address: "Location manually selected on map." }));
            map.flyTo(correctedLatLng, map.getZoom()); 
        },
    });
    return null;
}

// 2. مكون البحث (استمرار استخدام Esri مع التبديل التلقائي لضمان الثبات)

// 2. مكون البحث (استخدام OpenStreetMap Provider لتحسين دقة الأحياء)
function SearchControl({ setPosition, setForm }) {
    const map = useMap();

    useEffect(() => {
        // 💡 التغيير: العودة لـ OpenStreetMap Provider لأنه أفضل في العناوين المحلية
        const provider = new OpenStreetMapProvider({
            params: {
                // إزالة countrycodes: "LB" لتوسيع البحث ليشمل الأحياء والشوارع
                // إضافة language: 'ar' قد تساعد في بعض الحالات
            },
        });

        const searchControl = new GeoSearchControl({
            provider, 
            style: "bar", 
            showMarker: false, 
            retainZoomLevel: false,
            animateZoom: true, 
            autoClose: true, 
            // تعديل النص ليشمل العنوان التفصيلي
            searchLabel: "Enter full street or neighborhood name...", 
            keepResult: true,
        });

        map.addControl(searchControl);

        map.on("geosearch/showlocation", (result) => {
            const { x, y, label } = result.location;
            
            // استخدام القاعدة التجريبية التي عملت: القيمة الأصغر هي Latitude (34.xx)
            let latValue, lngValue;
            
            if (parseFloat(x) < parseFloat(y)) {
                latValue = parseFloat(x);
                lngValue = parseFloat(y);
            } else {
                latValue = parseFloat(y);
                lngValue = parseFloat(x);
            }

            const newPos = { lat: latValue, lng: lngValue };
            
            setPosition(newPos);
            setForm((prev) => ({ ...prev, customer_address: label }));
            map.flyTo(newPos, 17); // زيادة Zoom إلى 17 للاقتراب من الشارع
        });

        return () => map.removeControl(searchControl);
    }, [map, setPosition, setForm]);

    return null;
}

// function SearchControl({ setPosition, setForm }) {
//     const map = useMap();

//     useEffect(() => {
//         const provider = new EsriProvider({
//             params: {
//                 // تحديد منطقة البحث لزيادة الدقة
//                 bbox: '35.0,33.0,36.7,34.8' 
//             }
//         });

//         const searchControl = new GeoSearchControl({
//             provider, style: "bar", showMarker: false, retainZoomLevel: false,
//             animateZoom: true, autoClose: true, searchLabel: "Enter area in Tripoli...", keepResult: true,
//         });

//         map.addControl(searchControl);

//         map.on("geosearch/showlocation", (result) => {
//             const { x, y, label } = result.location;
            
//             // استخدام القاعدة التجريبية: القيمة الأصغر هي Latitude (34.xx)
//             let latValue, lngValue;
            
//             if (parseFloat(x) < parseFloat(y)) {
//                 latValue = parseFloat(x);
//                 lngValue = parseFloat(y);
//             } else {
//                 latValue = parseFloat(y);
//                 lngValue = parseFloat(x);
//             }

//             const newPos = { lat: latValue, lng: lngValue };
            
//             setPosition(newPos);
//             setForm((prev) => ({ ...prev, customer_address: label }));
//             map.flyTo(newPos, 16); 
//         });

//         return () => map.removeControl(searchControl);
//     }, [map, setPosition, setForm]);

//     return null;
// }

// 3. مكون المؤشر


function LocationSelector({ position, setPosition }) {
    const markerRef = useRef(null); 
    
    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    setPosition(marker.getLatLng());
                }
            },
        }),
        [setPosition]
    );

    if (position === null) return null;

    return (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={position}
            ref={markerRef} 
        >
            <Popup>Delivery Location</Popup>
        </Marker>
    );
}

// 4. المكون الرئيسي (بدون تغيير)
export default function CustomerForm() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        customer_name: "", customer_phone: "", customer_address: "", type_of_item: "",
    });
    
    const [position, setPosition] = useState(null);
    const [orderNumber, setOrderNumber] = useState("");
    const [open, setOpen] = useState(false);

    const itemOptions = ["Electronics", "Clothes", "Food Delivery", "Documents", "Furniture", "Other"];

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!position) {
            alert("❌ Please click on the map or search to select a location!");
            return;
        }

        try {
            const res = await api.post("public/order/submit", {
                customer: {
                    name: form.customer_name,
                    phone: form.customer_phone,
                    address: form.customer_address,
                    coords: {
                        lat: position.lat,
                        lng: position.lng,
                    },
                },
                type_of_item: form.type_of_item,
            });

            const id = res.data.order.order_number;
            setOrderNumber(id);
            setOpen(true);

        } catch (err) {
            console.error("❌ Error:", err);
            alert(err.response?.data?.error || "Failed to submit order.");
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Paper elevation={6} sx={{ padding: 3, maxWidth: 600, margin: "20px auto", borderRadius: 3 }}>
                
                <img src={Logo} alt="Logo" style={{ width: 90, height: 90, display: "block", margin: "0 auto 8px auto" }} />
                
                <Typography variant="h5" fontWeight={600} textAlign="center" mb={3}>Customer Delivery Request</Typography>

                <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    <TextField label="Full Name" name="customer_name" variant="outlined" fullWidth required value={form.customer_name} onChange={handleChange} />
                    <TextField label="Phone Number" name="customer_phone" type="tel" variant="outlined" fullWidth required value={form.customer_phone} onChange={handleChange} />
                    <TextField label="Address" name="customer_address" variant="outlined" fullWidth multiline rows={2} required value={form.customer_address} onChange={handleChange} />
                    
                    <TextField select label="Type of Item" name="type_of_item" variant="outlined" fullWidth required value={form.type_of_item} onChange={handleChange}>
                        {itemOptions.map((item, idx) => <MenuItem key={idx} value={item}>{item}</MenuItem>)}
                    </TextField>

                    <Typography fontWeight={600} mt={2}>Select Delivery Location</Typography>
                    
                    <Box sx={{ height: "350px", width: "100%", borderRadius: "12px", overflow: "hidden", border: position ? "2px solid green" : "1px solid #ccc" }}>
                        <MapContainer
                            center={[34.435, 35.836]} // طرابلس
                            zoom={13}
                            style={{ height: "100%", width: "100%" }}
                        >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                            
                            <MapClickHandler setPosition={setPosition} setForm={setForm} />
                            
                            <SearchControl setPosition={setPosition} setForm={setForm} />
                            <LocationSelector position={position} setPosition={setPosition} />
                        </MapContainer>
                    </Box>

                    <Typography variant="caption" align="center" color={position ? "success.main" : "error"}>
                        {position 
                            ? `Location Selected: ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` 
                            : "❌ No location selected. Please click on the map."}
                    </Typography>

                    <Button variant="contained" color="primary" type="submit" sx={{ paddingY: 1.4, borderRadius: 2, fontSize: "1rem" }}>
                        Submit
                    </Button>
                </Box>
            </Paper>

            <Modal open={open} onClose={() => setOpen(false)}>
                <Paper sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", padding: 4, maxWidth: 400, textAlign: "center", borderRadius: 2 }}>
                    <Typography variant="h6" mb={2}>Order Submitted!</Typography>
                    <Typography variant="h5" mb={3} sx={{ fontWeight: "bold" }}>{orderNumber}</Typography>
                    <Button variant="contained" onClick={() => navigate("/TrackingForm", { state: { orderNumber } })}>Track Order</Button>
                    <Button variant="outlined" color="secondary" sx={{ ml: 1 }} onClick={() => setOpen(false)}>Close</Button>
                </Paper>
            </Modal>
        </motion.div>
    );
}

// import { useState, useEffect } from "react";
// import { motion } from "framer-motion";
// import { useNavigate } from "react-router-dom";
// import { Box, TextField, MenuItem, Button, Paper, Typography, Modal } from "@mui/material";
// import { MapContainer, TileLayer, Marker, useMap, Popup, LayerGroup } from "react-leaflet";
// import { OpenStreetMapProvider, GeoSearchControl } from "leaflet-geosearch";
// import L from "leaflet";
// import api from "./api";
// import Logo from "../assets/Logo.png";

// // Fix default Leaflet marker icons
// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//     iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
//     iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
//     shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
// });

// // Search control component
// function SearchControl({ setPosition, setForm }) {
//     const map = useMap();

//     useEffect(() => {
//         const provider = new OpenStreetMapProvider({
//             params: {
//                 countrycodes: "LB",
//                 limit: 5,
//                 addressdetails: 1,
//             },
//         });

//         const searchControl = new GeoSearchControl({
//             provider,
//             style: "bar",
//             showMarker: false,
//             retainZoomLevel: false,
//             animateZoom: true,
//             autoClose: true,
//             searchLabel: "Enter street or area in Tripoli...",
//             keepResult: true,
//         });

//         map.addControl(searchControl);

//         map.on("geosearch/showlocation", (result) => {
//             const { x, y, label } = result.location;
//             setPosition({ lat: y, lng: x });
//             setForm((prev) => ({ ...prev, customer_address: label }));
//         });

//         return () => map.removeControl(searchControl);
//     }, [map, setPosition, setForm]);

//     return null;
// }

// // Draggable marker component
// function LocationSelector({ position, setPosition }) {
//     const map = useMap();

//     useEffect(() => {
//         if (!position) return;

//         const marker = L.marker(position, { draggable: true }).addTo(map);
//         marker.bindPopup("Drag to exact location").openPopup();

//         marker.on("dragend", (e) => {
//             const newPos = e.target.getLatLng();
//             setPosition(newPos);
//         });

//         return () => {
//             marker.remove();
//         };
//     }, [map, position, setPosition]);

//     return null;
// }

// // Optional: Layer for POIs (buildings, landmarks)
// function POILayer() {
//     const map = useMap();
//     useEffect(() => {
//         const poiLayer = L.tileLayer(
//             "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
//             { attribution: '&copy; OpenStreetMap contributors' }
//         );
//         poiLayer.addTo(map);
//         return () => map.removeLayer(poiLayer);
//     }, [map]);
//     return null;
// }

// export default function CustomerForm() {
//     const navigate = useNavigate();
//     const [form, setForm] = useState({
//         customer_name: "",
//         customer_phone: "",
//         customer_address: "",
//         type_of_item: "",
//     });
//     const [position, setPosition] = useState(null);
//     const [orderNumber, setOrderNumber] = useState("");
//     const [open, setOpen] = useState(false);

//     const itemOptions = ["Electronics", "Clothes", "Food Delivery", "Documents", "Furniture", "Other"];

//     const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });


//     const handleSubmit = async (e) => {
//         e.preventDefault();
//         if (!position) {
//             alert("Please select your delivery location on the map!");
//             return;
//         }

//         try {
//             const res = await api.post("public/order/submit", {
//                 customer: {
//                     name: form.customer_name,
//                     phone: form.customer_phone,
//                     address: form.customer_address,
//                     coords: {
//                         lat: position.lat,
//                         lng: position.lng,
//                     },
//                 },
//                 type_of_item: form.type_of_item,
//             });

//             const id = res.data.order.order_number;
//             setOrderNumber(id);
//             setOpen(true);

//         } catch (err) {
//             console.error("❌ Customer Form Submission Error:", err.response?.data?.error || err.message, err);
//             alert(err.response?.data?.error || "Failed to submit order. Check Server Console.");
//         }
//     };

//     return (
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
//             <Paper elevation={6} sx={{ padding: 3, maxWidth: 600, margin: "20px auto", borderRadius: 3 }}>

//                 <img
//                 src={Logo}
//                 alt="Company Logo"
//                 style={{ width: 90, height: "90", display: "flex" , marginLeft: "auto", marginRight: "auto", marginBottom: 8}}
//             />
//                 <Typography variant="h5" fontWeight={600} textAlign="center" mb={3}>Customer Delivery Request</Typography>

//                 <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
//                     <TextField label="Full Name" name="customer_name" variant="outlined" fullWidth required value={form.customer_name} onChange={handleChange} />
//                     <TextField label="Phone Number" name="customer_phone" type="tel" variant="outlined" fullWidth required value={form.customer_phone} onChange={handleChange} />
//                     <TextField label="Address" name="customer_address" variant="outlined" fullWidth multiline rows={2} required value={form.customer_address} onChange={handleChange} />
//                     <TextField select label="Type of Item" name="type_of_item" variant="outlined" fullWidth required value={form.type_of_item} onChange={handleChange}>
//                         {itemOptions.map((item, idx) => <MenuItem key={idx} value={item}>{item}</MenuItem>)}
//                     </TextField>

//                     <Typography fontWeight={600} mt={2}>Select Delivery Location</Typography>
//                     <MapContainer
//                         center={[33.888, 35.495]} zoom={10}
//                         style={{ height: "350px", marginBottom: "16px", borderRadius: "12px" }}
//                     >
//                         <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
//                         <POILayer />
//                         <SearchControl setPosition={setPosition} setForm={setForm} />
//                         <LocationSelector position={position} setPosition={setPosition} />
//                     </MapContainer>

//                     <Button variant="contained"  color="primary" type="submit" sx={{ paddingY: 1.4, borderRadius: 2, fontSize: "1rem" }}>
//                         Submit
//                     </Button>
//                 </Box>
//             </Paper>



//             <Modal open={open} onClose={() => setOpen(false)}>
//                 <Paper
//                     sx={{
//                         position: "absolute",
//                         top: "50%",
//                         left: "50%",
//                         transform: "translate(-50%, -50%)",
//                         padding: 4,
//                         maxWidth: 400,
//                         textAlign: "center",
//                         borderRadius: 2,
//                     }}
//                 >
//                     <Typography variant="h6" mb={2}>
//                         Order Submitted!
//                     </Typography>
//                     <Typography variant="body1" mb={2}>
//                         Your order number is:
//                     </Typography>
//                     <Typography
//                         variant="h5"
//                         mb={3}
//                         sx={{ fontWeight: "bold", wordBreak: "break-word" }}
//                     >
//                         {orderNumber}
//                     </Typography>

//                     {/* Button to go to tracking */}
//                     <Button
//                         variant="contained"
//                         color="primary"
//                         onClick={() =>
//                             navigate("/TrackingForm", { state: { orderNumber } })
//                         }
//                         sx={{ mr: 1 }}
//                     >
//                         Track My Order
//                     </Button>

//                     <Button
//                         variant="outlined"
//                         color="secondary"
//                         onClick={() => setOpen(false)}
//                     >
//                         Close
//                     </Button>
//                 </Paper>
//             </Modal>

//         </motion.div>
//     );
// }
