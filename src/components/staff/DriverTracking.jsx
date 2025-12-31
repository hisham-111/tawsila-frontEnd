
// import { useEffect, useState, useRef , useCallback } from "react";
// import {
//     Box,
//     Button,
//     Typography,
//     Paper,
//     CircularProgress,
//     Divider,
//     Modal,
//     Card,
//     CardContent,
//     Alert,
//     Dialog,
//     DialogTitle,
//     DialogContent,
//     DialogActions,
// } from "@mui/material";
// import { io } from "socket.io-client";
// import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
// import { useMap } from "react-leaflet";
// import "leaflet/dist/leaflet.css";
// import L from "leaflet";
// import api from "../api";
// import CheckCircleIcon from "@mui/icons-material/CheckCircle";
// import WifiIcon from "@mui/icons-material/Wifi";
// import GpsFixedIcon from "@mui/icons-material/GpsFixed";
// import { DirectionsCar, LocationOn } from "@mui/icons-material";
// import ReactDOMServer from 'react-dom/server';




// // Function to generate the HTML string for the MUI icon
// const createIconMarkup = (IconComponent, color) => {
//     // Render the React MUI icon component into an HTML string
//     return ReactDOMServer.renderToString(
//         <IconComponent sx={{ fontSize: 36, color: color, transform: 'translateY(15%)' }} />
//     );
// };

// // 1. Driver Icon (Car)
// const driverIcon = new L.divIcon({
//     html: createIconMarkup(DirectionsCar, '#0ABE51'), // Green Car
//     className: '', // Remove default Leaflet styling
//     iconSize: [36, 36],
//     iconAnchor: [18, 36], // Anchor at the bottom center of the icon
//     popupAnchor: [0, -36],
// });

// // 2. Customer Destination Icon (Home/Location Pin)
// const homeIcon = new L.divIcon({
//     html: createIconMarkup(LocationOn, '#f44336'), // Red Location Pin
//     className: '',
//     iconSize: [36, 36],
//     iconAnchor: [18, 36], // Anchor at the bottom center of the icon
//     popupAnchor: [0, -36],
// });

// const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "https://tawsila-backend-0shs.onrender.com";
// const userRole = 'driver';

// const driverZIndex = userRole === 'driver' ? 1000 : 10;
// const customerZIndex = userRole === 'customer' ? 1000 : 10;

// export default function DriverTracking({ initialOrderNumber, driverId }) {
    
//     // =======================================
//     // 1. STATE INITIALIZATION & PERSISTENCE 🛠️
//     // =======================================
    
//     // 💡 دالة للحصول على القيمة الأولية من Local Storage أو Props
//     const getPersistentOrderId = () => {
//         // 1. إذا تم تمرير رقم الطلب كـ prop، فاستخدمه (الأولوية للـ prop)
//         if (initialOrderNumber) return initialOrderNumber;
        
//         // 2. إذا لم يكن موجوداً، استرجع من Local Storage باستخدام Driver ID
//         if (driverId) {
//             return localStorage.getItem("acceptedOrderId_" + driverId) || null;
//         }
        
//         return null; // لا يوجد طلب مقبول
//     };

//     // ⬅️ استدعاء الدالة لتحديد القيمة الأولية **قبل** تعريف الـ State
//     const initialAcceptedOrderId = getPersistentOrderId();
    
//     // 🆕 حالة جديدة لحفظ قائمة الطلبات المتاحة التي تم جلبها من DB
//     const [availableOrders, setAvailableOrders] = useState([]);    
//     const [isTracking, setIsTracking] = useState(false);
//     const [currentPos, setCurrentPos] = useState(null);
//     const [statusMsg, setStatusMsg] = useState("Ready…");
//     const [socketConnected, setSocketConnected] = useState(false);
//     // حول السطر 104 في قسم تهيئة الحالة (STATE INITIALIZATION)
//     const [customerPos, setCustomerPos] = useState(null);
//     const [position, setPosition] = useState(null);
//     const [accuracy, setAccuracy] = useState(null);
//     const [error, setError] = useState(null);
    
//     // حالة للطلب اللحظي (Modal notification)
//     const [newOrder, setNewOrder] = useState(null);    
    
//     // ⬅️ استخدام القيمة المسترجعة كقيمة أولية للحالات
//     const [currentOrderId, setCurrentOrderId] = useState(initialAcceptedOrderId);
//     const [isOrderAccepted, setIsOrderAccepted] = useState(!!initialAcceptedOrderId);
    
//     // 🆕 حالة جديدة لإدارة ظهور نافذة تأكيد إيقاف التتبع
//     const [isConfirmingStop, setIsConfirmingStop] = useState(false); // <-- ADDED
    
//     // =======================================
//     // 2. REFS
//     // =======================================
    
//     const watchIdRef = useRef(null);
//     const socketRef = useRef(null);
    



//     // =======================================
// // 5. ACTION HANDLERS
// // =======================================

// // 🆕 الدالة المساعدة لجلب موقع العميل - مغلفة بـ useCallback
// const fetchCustomerLocation = useCallback(async (orderId) => {
//     try {
//         // استخدم orderId المُمرر، وليس currentOrderId
//         const response = await api.get(`/public/order/track/${orderId}`);
//         const customerCoords = response.data.customer.coords;

//         if (customerCoords && customerCoords.lat && customerCoords.lng) {
//             setCustomerPos(customerCoords);
//         }
//     } catch (error) {
//         console.error("Error fetching customer location:", error);
//     }
// }, [setCustomerPos]); // تعتمد على setCustomerPos فقط

//     // =======================================
//     // 3. FETCHING DATA (Initial Load)
//     // =======================================

//     // دالة لجلب الطلبات المتاحة من قاعدة البيانات عند التحميل
//     const fetchAvailableOrders = async () => {
//         if (!driverId) return;

//         try {
//             const res = await api.get(`/orders/orders/available`);    
            
//             if (res.data && res.data.orders) {
//                 console.log("Found available orders:", res.data.orders);
//                 // تصفية الطلب الحالي إذا كان لا يزال موجوداً في القائمة (لتجنب التكرار)
//                 const filteredOrders = res.data.orders.filter(
//                     order => order.order_number !== currentOrderId
//                 );
//                 setAvailableOrders(filteredOrders); 
//             }
//         } catch (error) {
//             console.error("Error fetching available orders:", error);
//             setStatusMsg(`Error: Failed to fetch orders. ${error.message}`);
//         }
//     };


//     const watchPosition = useCallback(() => {
//   if (!navigator.geolocation) {
//     setError("Geolocation not supported by your browser");
//     return;
//   }

//   const watchId = navigator.geolocation.watchPosition(
//     (pos) => {
//       const { latitude, longitude, accuracy } = pos.coords;
//       setAccuracy(accuracy);

//       // تجاهل المواقع منخفضة الدقة (أكثر من 30 متر)
//       if (accuracy <= 30) {
//         setPosition({ lat: latitude, lng: longitude });
//       } else {
//         console.warn(`Low accuracy (${accuracy}m), waiting for better GPS...`);
//       }
//     },
//     (err) => {
//       console.error(err);
//       setError(err.message);
//     },
//     { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
//   );

//   return () => navigator.geolocation.clearWatch(watchId);
// }, []);


// useEffect(() => {
//   // استدعاء watchPosition وتخزين الـ cleanup
//   const cleanup = watchPosition(); 

//   // تنظيف الـ watcher عند فك المكون
//   return cleanup;
// }, [watchPosition]);

    
//     // يتم استدعاء دالة الجلب عند تحميل المكون
//     useEffect(() => {
//         // إذا كان هناك طلب مقبول مسبقاً، لا داعي لجلب القائمة
//         if (!isOrderAccepted) {
//             fetchAvailableOrders();
//         }
//     }, [driverId, isOrderAccepted, currentOrderId]); // إضافة currentOrderId للـ dependencies

//     // =======================================
//     // 4. SOCKET.IO SETUP (Real-Time)
//     // =======================================

//     useEffect(() => {
//         if (!driverId) {
//             setStatusMsg("Error: Driver ID is missing.");
//             return;
//         }

//         // const socket = io(SOCKET_URL);
//         const socket = io(SOCKET_URL, {
//         transports: ["websocket", "polling"], // 🔥 يحل مشكلة الهاتف
//         withCredentials: true,
//         reconnection: true,
//         reconnectionAttempts: 5,
//         timeout: 20000,
//         });

//         socketRef.current = socket;

//         socket.on("connect", () => {
//             setSocketConnected(true);
//             setStatusMsg("Connected ✔ Ready to receive orders");
//             socket.emit("driver-join", driverId);    
//         });

//         const handleNewOrder = (orderData) => {
//             console.log("🔥 RECEIVED NEW ORDER VIA SOCKET:", orderData);
//             // إضافة الطلب الجديد إلى القائمة فقط إذا لم يكن مقبولاً بالفعل
//             if (!isOrderAccepted && orderData.order_number !== currentOrderId) {
//                 setAvailableOrders(prevOrders => [orderData, ...prevOrders]);
//                 // وعرض الـ Modal كإشعار لحظي
//                 setNewOrder(orderData);    
//             }
//         };

//         socket.on("new-order", handleNewOrder); 
        
//         socket.on("order-accepted", (data) => {
//             // إزالة الطلب من قائمة الطلبات المتاحة إذا قبله سائق آخر
//             setAvailableOrders(prevOrders =>    
//                 prevOrders.filter(order => order.order_number !== data.order_number)
//             );
            
//             if (newOrder && newOrder.order_number === data.order_number) {
//                 setNewOrder(null);    
//                 alert(`Order #${data.order_number}  accepted by driver.`);
//             }
//         });

//         socket.on("disconnect", () => {
//             setSocketConnected(false);
//             setStatusMsg("Disconnected… Reconnecting");
//         });

//         return () => {
//             socket.off("new-order", handleNewOrder);
//             socket.off("order-accepted");
//             socket.disconnect();
//         };
//     }, [driverId, isOrderAccepted, newOrder, currentOrderId]); // إضافة currentOrderId للـ dependencies


  



// useEffect(() => {
//     // Fetches static customer coordinates when an order is accepted
//     if (currentOrderId && isOrderAccepted) {
//         fetchCustomerLocation(currentOrderId);
//     }
// }, [currentOrderId, isOrderAccepted, fetchCustomerLocation]);


// // Add this new effect after your state initialization section:

// // =======================================
// // 7. NEW EFFECT: AUTO-RESUME DRIVER TRACKING 🚀
// // =======================================
// useEffect(() => {
//     // If an order was accepted (from local storage/props)
//     // AND tracking is currently NOT active, resume tracking.
//     if (isOrderAccepted && !isTracking) {
//         setStatusMsg("Resuming tracking for accepted order...");
        
//         // Use a slight delay to ensure the component has fully rendered 
//         // and states are settled before accessing the Geolocation API.
//         const timer = setTimeout(() => {
//             // This function initiates the GPS watchPosition loop.
//             startTracking();
//         }, 100); 

//         return () => clearTimeout(timer); // Cleanup timer if component unmounts quickly
//     }
//     // Dependency array ensures this only runs when tracking state changes 
//     // or when an order is initially deemed accepted.
// }, [isOrderAccepted, isTracking]); 

// // ---
// // Your existing useEffect (no changes needed here):

// useEffect(() => {
//     // 1. متى يجب أن يتم الجلب؟ عندما يتوفر رقم الطلب الحالي
//     if (currentOrderId && isOrderAccepted) {
        
//         // 🚀 استدعاء الدالة المساعدة مباشرةً باستخدام رقم الطلب
//         fetchCustomerLocation(currentOrderId);
//     }
// }, [currentOrderId, isOrderAccepted, fetchCustomerLocation]);



// function MapCentering({ driverPos, customerPos }) {
//     const map = useMap();

//     useEffect(() => {
//         if (driverPos && customerPos) {
//             // إذا كان موقع السائق والعميل معروفاً، قم بضبط عرض الخريطة ليشمل كلاهما
//             const bounds = L.latLngBounds([driverPos, [customerPos.lat, customerPos.lng]]);
//             map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
//         } else if (driverPos) {
//             // إذا كان موقع السائق فقط معروفاً، قم بالتركيز عليه
//             map.setView(driverPos, map.getZoom() < 14 ? 14 : map.getZoom());
//         }
//     }, [map, driverPos, customerPos]);

//     return null;
// }
    
//     // =======================================
//     // 5. ACTION HANDLERS
//     // =======================================

   

//     const handleAcceptOrder = async (orderToAccept) => {
//     const orderNumber = orderToAccept.order_number;
    
//     try {
//         setStatusMsg(`Accepting order #${orderNumber}...`);
//         const res = await api.post("/orders/accept", {
//             order_number: orderNumber,
//             driver_id: driverId,
//         });

//         if (res.status === 200 || res.status === 201) {
//             // 🚀 الحفظ في Local Storage
//             localStorage.setItem("acceptedOrderId_" + driverId, orderNumber);
            
//             setCurrentOrderId(orderNumber);
//             setIsOrderAccepted(true);
//             setNewOrder(null);
            
//             // 🆕 💡 الخطوة الجديدة: جلب موقع العميل فوراً وتحديث الحالة
//             if (orderToAccept.customer && orderToAccept.customer.coords) {
//                 const customerCoords = orderToAccept.customer.coords;
//                 // يجب أن يكون الكائن customerPos { lat: X, lng: Y }
//                 setCustomerPos({ lat: customerCoords.lat, lng: customerCoords.lng }); 
//             } else {
//                 // إذا لم يتم تمرير الإحداثيات في كائن الطلب، يجب جلبها عبر API
//                 // هذا يضمن ظهور موقع العميل حتى لو لم يكن متاحاً في كائن الطلب الأولي
//                 await fetchCustomerLocation(orderNumber);
//             }
            
//             // إزالة الطلب المقبول من قائمة الطلبات المتاحة
//             setAvailableOrders(prevOrders => 
//                 prevOrders.filter(order => order.order_number !== orderNumber)
//             );
            
//             setStatusMsg(`Order #${orderNumber} accepted! Start tracking.`);
//         }
//     } catch (error) {
//         console.error("Error accepting order:", error);
//         const errMsg = error.response?.data?.error || "Acceptance failed!";
//         setStatusMsg(`Failed to accept order: ${errMsg}`);
//         alert(errMsg);
//     }
// };

  
  

// const startTracking = () => {
//     if (!navigator.geolocation) {
//         alert("Your device does not support geolocation.");
//         return;
//     }

//     if (!isOrderAccepted) {
//         alert("Please accept an order first.");
//         return;
//     }

//     // تنظيف أي تتبع سابق
//     if (watchIdRef.current) {
//         navigator.geolocation.clearWatch(watchIdRef.current);
//         watchIdRef.current = null;
//     }

//     setIsTracking(true);
//     setStatusMsg("📡 Initializing location tracking...");

//     const orderToTrack = currentOrderId;

//     // 🧠 تحديد نوع الجهاز
//     const isBrowser = !/Mobi|Android/i.test(navigator.userAgent);

//     watchIdRef.current = navigator.geolocation.watchPosition(
//         (pos) => {
//             const { latitude, longitude, accuracy } = pos.coords;

//             // تحديث الموقع محليًا دائمًا (حتى لو كانت الدقة ضعيفة)
//             setCurrentPos([latitude, longitude]);

//             // 🧠 رسائل ذكية حسب الدقة (بدون Warning)
//             if (accuracy <= 100) {
//                 setStatusMsg("📡 High accuracy tracking");
//             } else if (accuracy <= 3000) {
//                 setStatusMsg("📍 Standard tracking mode");
//             } else if (isBrowser) {
//                 setStatusMsg("🖥️ Browser location mode (approximate)");
//             } else {
//                 setStatusMsg("📡 Low GPS signal, tracking continues");
//             }

//             // 🚀 إرسال الموقع دائمًا (لا نوقف الإرسال)
//             if (socketRef.current?.connected && orderToTrack) {
//                 socketRef.current.emit("update-location", {
//                     orderId: orderToTrack,
//                     driverId,
//                     lat: latitude,
//                     lng: longitude,
//                     accuracy,
//                     source: isBrowser ? "browser" : "gps",
//                     timestamp: Date.now(),
//                 });
//             }
//         },

//         // ❌ أخطاء التتبع
//         (err) => {
//             let errorMsg = "Location error: ";

//             switch (err.code) {
//                 case err.PERMISSION_DENIED:
//                     errorMsg += "Permission denied. Please allow location access.";
//                     break;
//                 case err.POSITION_UNAVAILABLE:
//                     errorMsg += "Position unavailable.";
//                     break;
//                 case err.TIMEOUT:
//                     errorMsg += "Location request timed out.";
//                     break;
//                 default:
//                     errorMsg += err.message;
//             }

//             console.error("Geolocation Error:", err);
//             setStatusMsg(errorMsg);
//         },

//         // ⚙️ إعدادات محسّنة للويب والموبايل
//         {
//             enableHighAccuracy: !isBrowser, // GPS فقط للموبايل
//             maximumAge: isBrowser ? 30000 : 0,
//             timeout: isBrowser ? 30000 : 20000,
//         }
//     );
// };


// const stopTracking = () => {
//         setIsConfirmingStop(true);
//     };
    
//     // 🚀 Second step: actual delivery completion logic (runs on confirmation)
//     const handleConfirmStop = async () => {
//         // 1. Close confirmation dialog
//         setIsConfirmingStop(false);

//         // 2. إيقاف تتبع الموقع
//         navigator.geolocation.clearWatch(watchIdRef.current);
//         watchIdRef.current = null;
//         setIsTracking(false);
//         setStatusMsg("Delivery completed! Awaiting new order.");

//         const orderToTrack = currentOrderId;

//         if (socketRef.current?.connected && orderToTrack) {
//             // إرسال آخر موقع مؤكد للتسليم
//             if (currentPos) {
//                 socketRef.current.emit("update-location", {
//                     orderId: orderToTrack,
//                     driverId,
//                     lat: currentPos[0],
//                     lng: currentPos[1],
//                 });
//             }

//             // إرسال الحدث الجديد للتسليم
//             socketRef.current.emit("order-delivered", {
//                 orderId: orderToTrack,
//                 driverId,
//             });

//             // 🚀 الحذف من Local Storage
//             localStorage.removeItem("acceptedOrderId_" + driverId);

//             // إعادة تعيين الحالة للبدء من جديد
//             setCurrentOrderId(null);
//             setIsOrderAccepted(false);

//             // إعادة جلب الطلبات المتاحة
//             await fetchAvailableOrders();
//         }
//     };
    
//     // =======================================
//     // 6. RENDERING LOGIC
//     // =======================================
    
//     const renderAvailableOrdersList = () => (
//         <Paper 
//             elevation={8} 
//             sx={{ width: "100%", maxWidth: 600, p: 3, borderRadius: 4 }}
//         >
//             <Typography variant="h5" fontWeight={700} textAlign="center" mb={3}>
//                 📦 Available Orders ({availableOrders.length})
//             </Typography>
//             <Divider sx={{ mb: 3 }} />

//             {availableOrders.length === 0 ? (
//                 <Alert severity="info" sx={{ textAlign: 'center' }}>
//                     Waiting for new delivery requests...
//                 </Alert>
//             ) : (
//                 <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//                     {availableOrders.map((order) => (
//                         <Card key={order.order_number} variant="outlined" sx={{ p: 1.5 }}>
//                             <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
//                                 <Typography variant="h6" color="primary">Order #{order.order_number}</Typography>
//                                 <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
//                                     <LocationOn fontSize="small" />    
//                                     <strong>Address:</strong> {order.customer?.address || 'N/A'}
//                                 </Typography>
//                                 <Typography variant="body2" color="text.secondary">
//                                     <strong>Item:</strong> {order.type_of_item || 'General'} | <strong>Received:</strong> {new Date(order.createdAt).toLocaleTimeString()}
//                                 </Typography>
//                                 <Button    
//                                     variant="contained"    
//                                     color="success"    
//                                     size="small"    
//                                     onClick={() => handleAcceptOrder(order)}
//                                     sx={{ mt: 1, float: 'right' }}
//                                 >
//                                     Accept
//                                 </Button>
//                             </CardContent>
//                         </Card>
//                     ))}
//                 </Box>
//             )}
//         </Paper>
//     );

//     // الوظيفة الرئيسية: إما عرض قائمة الطلبات أو واجهة التتبع
//     if (!isOrderAccepted) {
//         return (
//             <Box
//                 sx={{
//                     width: "100%",
//                     display: "flex",
//                     justifyContent: "center",
//                     mt: { xs: 2, sm: 3 },
//                     px: { xs: 1, sm: 2 },
//                 }}
//             >
//                 {renderAvailableOrdersList()}

//                 {/* New Order Modal (يبقى كما هو للإشعارات اللحظية) */}
//                 <Modal open={!!newOrder} onClose={() => setNewOrder(null)}>
//                     <Paper    
//                         sx={{
//                             position: "absolute",
//                             top: "50%",
//                             left: "50%",
//                             transform: "translate(-50%, -50%)",
//                             width: { xs: "85%", sm: 400 },
//                             p: { xs: 2, sm: 3 },
//                             textAlign: "center",
//                             borderRadius: 3,
//                         }}
//                     >
//                         <Typography variant="h6" fontWeight={700} color="primary" mb={2}>
//                             <CheckCircleIcon fontSize="small" sx={{ mr: 1 }} /> New Delivery Request
//                         </Typography>

//                         {newOrder && (
//                             <Box textAlign="left" mb={2} sx={{ bgcolor: "#f5f5f5", p: 2, borderRadius: 2 }}>
//                                 <Typography variant="body2"><strong>Order ID:</strong> {newOrder.order_number}</Typography>
//                                 <Typography variant="body2"><strong>Item Type:</strong> {newOrder.type_of_item}</Typography>
//                                 <Typography variant="body2" sx={{ wordWrap: "break-word" }}>
//                                     <strong>Address:</strong> {newOrder.customer_address || newOrder.customer?.address}
//                                 </Typography>
//                             </Box>
//                         )}

//                         <Button    
//                             variant="contained"    
//                             color="success"    
//                             fullWidth    
//                             onClick={() => handleAcceptOrder(newOrder)}
//                             sx={{ py: 1.5, fontSize: "0.95rem", fontWeight: 600, mb: 1 }}
//                         >
//                             Accept Order
//                         </Button>
//                         <Button
//                             variant="outlined"
//                             color="error"
//                             fullWidth
//                             onClick={() => setNewOrder(null)}
//                             sx={{ py: 1.5, fontWeight: 600 }}
//                         >
//                             Decline
//                         </Button>
//                     </Paper>
//                 </Modal>
//             </Box>
//         );
//     }
    
//     // العرض في حالة قبول الطلب
//     return (
//         <Box
//             sx={{
//                 width: "100%",
//                 display: "flex",
//                 justifyContent: "center",
//                 mt: { xs: 2, sm: 3 },
//                 px: { xs: 1, sm: 2 },
//             }}
//         >
//             <Paper
//                 elevation={8}
//                 sx={{
//                     width: "100%",
//                     maxWidth: 600,    
//                     p: { xs: 2, sm: 3 },
//                     borderRadius: 4,
//                     background: "#ffffff",
//                     boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
//                 }}
//             >
//                 {/* Header, Status, Info Sections */}
                
//                 <Typography
//                     fontWeight={700}
//                     variant="h5"
//                     textAlign="center"
//                     mb={2}
//                     sx={{
//                         display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
//                         fontSize: { xs: "1.2rem", sm: "1.5rem", md: "1.8rem" },
//                     }}
//                 >
//                     <DirectionsCar sx={{ fontSize: { xs: 28, sm: 32, md: 36 }, color: "#0ABE51" }} />
//                     Live Driver Tracking
//                 </Typography>

//                 <Paper
//                     elevation={0}
//                     sx={{
//                         display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5, mb: 2, borderRadius: 3,
//                         background: socketConnected ? "#e6f4ea" : "#ffeaea",
//                         border: socketConnected ? "1px solid #4caf50" : "1px solid #f44336",
//                     }}
//                 >
//                     <Typography
//                         variant="body2" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}
//                     >
//                         <WifiIcon fontSize="small" color={socketConnected ? "success" : "error"} />
//                         {socketConnected ? "Connected" : "Offline"}
//                     </Typography>
//                     <Typography variant="body2">{statusMsg}</Typography>
//                 </Paper>

//                 <Box
//                     sx={{
//                         p: 1.5, mb: 2, borderRadius: 3, background: "#f7f9fc", border: "1px solid #e0e6ed",
//                         fontSize: { xs: "0.8rem", sm: "0.9rem", md: "0.95rem" },
//                     }}
//                 >
//                     <Typography><strong>Order ID:</strong> {currentOrderId}</Typography>
//                     <Typography><strong>Driver ID:</strong> {driverId}</Typography>
//                     <Typography sx={{ display: "flex", alignItems: "center", gap: 1 }}>
//                         <GpsFixedIcon fontSize="small" color="primary" /> <strong>Status:</strong> {statusMsg}
//                     </Typography>
//                 </Box>

//                 <Divider sx={{ my: 2 }} />

//                 {/* Map Section */}
//                 <Box
//                     sx={{
//                         height: { xs: 150, sm: 180, md: 200 }, width: "100%", borderRadius: 3, overflow: "hidden", mb: 2, border: "1px solid #ddd", mx: "auto",
//                     }}
//                 >
//                     {currentPos ? (
                 
                 
//                  <MapContainer center={currentPos} zoom={16} style={{ height: "100%", width: "100%" }}>
//                             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

//                             <MapCentering 
//                                     driverPos={currentPos} 
//                                     customerPos={customerPos} 
//                                 />
//                             <Marker position={currentPos} icon={driverIcon}
//                             zIndexOffset={driverZIndex}
//                             >
//                                 <Popup>Your Location</Popup>
//                             </Marker>

//                             {/* إضافة خط المسار بين السائق والعميل */}
//                             {currentPos && customerPos && (
//                             <Polyline
//                             // يربط بين [موقع السائق] و [موقع العميل]
//                             positions={[currentPos, [customerPos.lat, customerPos.lng]]}
//                             color="blue" dashArray="10,10" opacity={0.6}
//                             />
//                             )}


//                            {customerPos && (
//                                 <Marker 
//                                     position={[customerPos.lat, customerPos.lng]} 
//                                     icon={homeIcon} // 👍 هذه هي علامة العميل
//                                     zIndexOffset={customerZIndex}
//                                 >
//                                     <Popup>Customer Pickup Location</Popup>
//                                 </Marker>
//                             )}
                            
//                             {/* ❓ يجب أن تكون علامة منزل العميل هنا! */}
//                         </MapContainer>
                        
//                     ) : (
//                         <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", flexDirection: "column", gap: 1, }}>
//                             <CircularProgress size={24} />
//                             <Typography color="textSecondary" fontSize="0.85rem">
//                                 Waiting for GPS…
//                             </Typography>
//                         </Box>
//                     )}
//                 </Box>

//                 {/* Buttons */}
//                 <Box display="flex" flexDirection={{ xs: "column", sm: "row" }} gap={1.5}>
//                     {!isTracking ? (
//                         <Button
//                             variant="contained" fullWidth color="success" onClick={startTracking} size="large"
//                             disabled={!isOrderAccepted}
//                             sx={{ py: 1.6, fontSize: { xs: "0.9rem", sm: "1rem" }, borderRadius: 3, fontWeight: 600, }}
//                         >
//                             Start Delivery
//                         </Button>
//                     ) : (
//                         <Button
//                             // 💡 Changed onClick to trigger the confirmation dialog
//                             variant="contained" fullWidth color="error" onClick={stopTracking} size="large"
//                             sx={{ py: 1.6, fontSize: { xs: "0.9rem", sm: "1rem" }, borderRadius: 3, fontWeight: 600, }}
//                         >
//                             Stop Delivery
//                         </Button>
//                     )}
//                 </Box>
//             </Paper>

//             {/* 🛑 STOP TRACKING CONFIRMATION DIALOG 🛑 */}
//             <Dialog
//                 open={isConfirmingStop}
//                 onClose={() => setIsConfirmingStop(false)}
//                 aria-labelledby="stop-tracking-dialog-title"
//                 maxWidth="xs"
//                 fullWidth
//             >
//                 <DialogTitle id="stop-tracking-dialog-title" sx={{ color: "error.main", fontWeight: 700 }}>
//                     <DirectionsCar sx={{ mr: 1 }} /> Confirm Delivery Completion
//                 </DialogTitle>
//                 <Divider />
//                 <DialogContent>
//                     <Typography variant="body1" sx={{ mb: 1.5 }}>
//                         Are you sure you want to mark Order **#{currentOrderId}** as **Delivered** and stop sending your location?
//                     </Typography>
//                     <Alert severity="warning">
//                         This action is irreversible for the current order, clears your local data, and will prepare you for a new assignment.
//                     </Alert>
//                 </DialogContent>
//                 <DialogActions sx={{ p: 2, pt: 0 }}>
//                     <Button
//                         onClick={() => setIsConfirmingStop(false)}
//                         color="primary"
//                         variant="outlined"
//                         sx={{ fontWeight: 600 }}
//                     >
//                         Cancel
//                     </Button>
//                     <Button
//                         onClick={handleConfirmStop} // 🚀 Calls the final delivery logic
//                         color="error"
//                         variant="contained"
//                         autoFocus
//                         sx={{ fontWeight: 600 }}
//                     >
//                         Confirm Stop Tracking
//                     </Button>
//                 </DialogActions>
//             </Dialog>
//         </Box>
//     );
// }


import { useEffect, useState, useRef, useCallback } from "react";
import {
  Box, Button, Typography, Paper, CircularProgress, Divider,
  Modal, Card, CardContent, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions
} from "@mui/material";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../api";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WifiIcon from "@mui/icons-material/Wifi";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import { DirectionsCar, LocationOn } from "@mui/icons-material";
import ReactDOMServer from 'react-dom/server';

// =====================
// ICONS SETUP
// =====================

const createIconMarkup = (IconComponent, color) =>
  ReactDOMServer.renderToString(
    <IconComponent sx={{ fontSize: 36, color: color, transform: 'translateY(15%)' }} />
  );

const driverIcon = new L.divIcon({
  html: createIconMarkup(DirectionsCar, '#0ABE51'),
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const homeIcon = new L.divIcon({
  html: createIconMarkup(LocationOn, '#f44336'),
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

// =====================
// SOCKET & USER SETUP
// =====================

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "https://tawsila-backend-0shs.onrender.com";
const userRole = 'driver';
const driverZIndex = userRole === 'driver' ? 1000 : 10;
const customerZIndex = userRole === 'customer' ? 1000 : 10;

// =====================
// COMPONENT
// =====================

export default function DriverTracking({ initialOrderNumber, driverId }) {
  
  // =====================
  // STATE
  // =====================
  const getPersistentOrderId = () => {
    if (initialOrderNumber) return initialOrderNumber;
    if (driverId) return localStorage.getItem("acceptedOrderId_" + driverId) || null;
    return null;
  };

  const initialAcceptedOrderId = getPersistentOrderId();

  const [availableOrders, setAvailableOrders] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState(null);
  const [currentAddress, setCurrentAddress] = useState(null); // ✅ العنوان التفصيلي للسائق
  const [customerPos, setCustomerPos] = useState(null);
  const [customerAddress, setCustomerAddress] = useState(null); // ✅ العنوان التفصيلي للعميل
  const [accuracy, setAccuracy] = useState(null);
  const [statusMsg, setStatusMsg] = useState("Ready…");
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState(null);
  const [newOrder, setNewOrder] = useState(null);
  const [currentOrderId, setCurrentOrderId] = useState(initialAcceptedOrderId);
  const [isOrderAccepted, setIsOrderAccepted] = useState(!!initialAcceptedOrderId);
  const [isConfirmingStop, setIsConfirmingStop] = useState(false);
  const [mockLocation, setMockLocation] = useState({ lat: 34.4386, lng: 35.8495 });

  // =====================
  // REFS
  // =====================
  const watchIdRef = useRef(null);
  const socketRef = useRef(null);

  // =====================
  // HELPER: REVERSE GEOCODING
  // =====================
//   const fetchDetailedAddress = async (lat, lng) => {
//     try {
//       const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
//       const data = await res.json();
//       return data.display_name;
//     } catch (err) {
//       console.error("Reverse geocoding error:", err);
//       return null;
//     }
//   };

// const fetchDetailedAddress = async (lat, lng) => {
//   try {
//     const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
//     const data = await res.json();
//     const { road, house_number, suburb, city, postcode } = data.address || {};
//     // تكوين العنوان التفصيلي
//     let detailedAddress = '';
//     if (house_number) detailedAddress += house_number + ' ';
//     if (road) detailedAddress += road + ', ';
//     if (suburb) detailedAddress += suburb + ', ';
//     if (city) detailedAddress += city + ', ';
//     if (postcode) detailedAddress += postcode;
//     return detailedAddress || data.display_name;
//   } catch (err) {
//     console.error("Reverse geocoding error:", err);
//     return null;
//   }
// };

const fetchDetailedAddress = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
    const data = await res.json();
    const { road, house_number, suburb, city, postcode } = data.address || {};
    let detailedAddress = '';
    if (house_number) detailedAddress += house_number + ' ';
    if (road) detailedAddress += road + ', ';
    if (suburb) detailedAddress += suburb + ', ';
    if (city) detailedAddress += city + ', ';
    if (postcode) detailedAddress += postcode;
    return detailedAddress || data.display_name || "Unknown location";
  } catch (err) {
    console.error("Reverse geocoding error:", err);
    return "Unknown location";
  }
};



  // =====================
  // FETCH CUSTOMER LOCATION
  // =====================
  const fetchCustomerLocation = useCallback(async (orderId) => {
    try {
      const response = await api.get(`/public/order/track/${orderId}`);
      const customerCoords = response.data.customer.coords;

      if (customerCoords && customerCoords.lat && customerCoords.lng) {
        setCustomerPos(customerCoords);

        // جلب العنوان التفصيلي
        const address = await fetchDetailedAddress(customerCoords.lat, customerCoords.lng);
        if (address) setCustomerAddress(address);
      }
    } catch (err) {
      console.error("Error fetching customer location:", err);
    }
  }, []);

  // =====================
  // WATCH POSITION
  // =====================
  // const watchPosition = useCallback(() => {
  //   if (!navigator.geolocation) {
  //     setError("Geolocation not supported by your browser");
  //     return;
  //   }

  //   const watchId = navigator.geolocation.watchPosition(
  //     async (pos) => {
  //       const { latitude, longitude, accuracy } = pos.coords;
  //       setAccuracy(accuracy);

  //       if (accuracy <= 130) {
  //         setCurrentPos({ lat: latitude, lng: longitude });
  //         const address = await fetchDetailedAddress(latitude, longitude);
  //         if (address) setCurrentAddress(address);
  //       }
  //     },
  //     (err) => {
  //       console.error(err);
  //       setError(err.message);
  //     },
  //     { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  //   );

  //   return () => navigator.geolocation.clearWatch(watchId);
  // }, []);

  // useEffect(() => {
  //   const cleanup = watchPosition();
  //   return cleanup;
  // }, [watchPosition]);

  // =====================
  // SOCKET.IO SETUP
  // =====================
  useEffect(() => {
    if (!driverId) return;
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"], withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      setStatusMsg("Connected ✔ Ready to receive orders");
      socket.emit("driver-join", driverId);
    });

    const handleNewOrder = (orderData) => {
      if (!isOrderAccepted && orderData.order_number !== currentOrderId) {
        setAvailableOrders(prev => [orderData, ...prev]);
        setNewOrder(orderData);
      }
    };

    socket.on("new-order", handleNewOrder);

    socket.on("order-accepted", (data) => {
      setAvailableOrders(prev => prev.filter(o => o.order_number !== data.order_number));
      if (newOrder && newOrder.order_number === data.order_number) setNewOrder(null);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setStatusMsg("Disconnected… Reconnecting");
    });

    return () => {
      socket.off("new-order", handleNewOrder);
      socket.disconnect();
    };
  }, [driverId, isOrderAccepted, newOrder, currentOrderId]);

  // =====================
  // FETCH AVAILABLE ORDERS
  // =====================
  const fetchAvailableOrders = async () => {
    if (!driverId) return;
    try {
      const res = await api.get(`/orders/orders/available`);
      if (res.data?.orders) {
        const filteredOrders = res.data.orders.filter(o => o.order_number !== currentOrderId);
        setAvailableOrders(filteredOrders);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg(`Error fetching orders: ${err.message}`);
    }
  };

  useEffect(() => {
    if (!isOrderAccepted) fetchAvailableOrders();
  }, [driverId, isOrderAccepted, currentOrderId]);

  // =====================
  // HANDLE ACCEPT ORDER
  // =====================
  const handleAcceptOrder = async (orderToAccept) => {
    const orderNumber = orderToAccept.order_number;
    try {
      setStatusMsg(`Accepting order #${orderNumber}...`);
      const res = await api.post("/orders/accept", { order_number: orderNumber, driver_id: driverId });
      if (res.status === 200 || res.status === 201) {
        localStorage.setItem("acceptedOrderId_" + driverId, orderNumber);
        setCurrentOrderId(orderNumber);
        setIsOrderAccepted(true);
        setNewOrder(null);

        // جلب موقع العميل
        if (orderToAccept.customer?.coords) {
          setCustomerPos(orderToAccept.customer.coords);
          const addr = await fetchDetailedAddress(orderToAccept.customer.coords.lat, orderToAccept.customer.coords.lng);
          if (addr) setCustomerAddress(addr);
        } else {
          await fetchCustomerLocation(orderNumber);
        }

        setAvailableOrders(prev => prev.filter(o => o.order_number !== orderNumber));
        setStatusMsg(`Order #${orderNumber} accepted! Start tracking.`);
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || "Acceptance failed!";
      setStatusMsg(`Failed to accept order: ${errMsg}`);
      alert(errMsg);
    }
  };

  // =====================
  // MAP CENTERING
  // =====================

  function MapCentering({ driverPos, customerPos }) {
  const map = useMap();
  useEffect(() => {
    if (driverPos && customerPos) {
      map.fitBounds([driverPos, [customerPos.lat, customerPos.lng]], { padding: [50, 50], maxZoom: 16 });
    } else if (driverPos) {
      map.setView(driverPos, map.getZoom() < 14 ? 14 : map.getZoom());
    } else if (customerPos) {
      map.setView([customerPos.lat, customerPos.lng], 14);
    }
  }, [driverPos, customerPos, map]);
  return null;
}


  // =====================
  // START TRACKING
  // =====================
 

// const startTracking = () => {
//   if (!navigator.geolocation || !isOrderAccepted) return;

//   if (watchIdRef.current) {
//     navigator.geolocation.clearWatch(watchIdRef.current);
//   }

//   setIsTracking(true);
//   setStatusMsg("📡 Initializing GPS… waiting for good accuracy");

//  const isDev = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);  // بيئة DEV على الحاسوب

// watchIdRef.current = navigator.geolocation.watchPosition(
//   async (pos) => {
//     let { latitude, longitude, accuracy } = pos.coords;

//     // في DEV استخدم mock location لطرابلس
//     // if (isDev) {
//     //   latitude = 34.4386;  // مثال: طرابلس
//     //   longitude = 35.8495; // مثال: طرابلس
//     //   accuracy = 50;
//     // }
//           if (isDev) {
//           latitude = mockLocation.lat;
//           longitude = mockLocation.lng;
//           accuracy = 50;
//       }
//       // تجاهل القراءات غير المنطقية
//       if (typeof latitude !== "number" || typeof longitude !== "number" || accuracy == null) return;

//       // تجاهل القراءة إذا كانت ضعيفة جدًا (>500m)
//       if (!isDev && accuracy > 500) {
//         setStatusMsg(`📡 Improving GPS accuracy… (${Math.round(accuracy)}m)`);
//         return;
//       }

//       // ✅ الموقع صالح
//       const newPos = { lat: latitude, lng: longitude };
//       setCurrentPos(newPos);
//       setAccuracy(accuracy);
//       setStatusMsg(`📡 GPS locked (${Math.round(accuracy)}m)`);

//       // إرسال الموقع إلى السيرفر
//       if (socketRef.current?.connected && currentOrderId) {
//         socketRef.current.emit("update-location", {
//           orderId: currentOrderId,
//           driverId,
//           ...newPos,
//           accuracy,
//           timestamp: Date.now(),
//         });
//       }

//       // جلب العنوان التفصيلي (Reverse Geocoding)
//       try {
//         const addr = await fetchDetailedAddress(latitude, longitude);
//         if (addr) setCurrentAddress(addr);
//       } catch (err) {
//         console.warn("Reverse geocoding failed:", err);
//       }
//     },
//     (err) => {
//       console.error("GPS error:", err);
//       setStatusMsg("📡 GPS error: " + err.message);
//     },
//     {
//       enableHighAccuracy: true,
//       maximumAge: 0,
//       timeout: 15000,
//     }
//   );
// };

const startTracking = () => {
  if (!isOrderAccepted || !currentOrderId) return;

  // 🧠 تحديد البيئة
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // تنظيف أي تتبع سابق
  if (watchIdRef.current) {
    navigator.geolocation.clearWatch(watchIdRef.current);
  }

  setIsTracking(true);
  setStatusMsg("📡 Starting location tracking...");

  // =========================
  // 📱 MOBILE → GPS حقيقي
  // =========================
  if (isMobile && navigator.geolocation) {
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        setCurrentPos({ lat: latitude, lng: longitude });
        setStatusMsg(`📡 GPS accuracy: ${Math.round(accuracy)}m`);

        if (socketRef.current?.connected) {
          socketRef.current.emit("update-location", {
            orderId: currentOrderId,
            driverId,
            lat: latitude,
            lng: longitude,
            accuracy,
            timestamp: Date.now(),
          });
        }
      },
      (err) => {
        setStatusMsg("❌ GPS Error: " + err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    return;
  }

  // =========================
  // 💻 DESKTOP → Mock Movement
  // =========================
  setStatusMsg("🧪 Desktop mode: Simulated movement");

  let lat = 34.4386; // طرابلس
  let lng = 35.8495;

  watchIdRef.current = setInterval(() => {
    // محاكاة حركة حقيقية
    lat += (Math.random() - 0.5) * 0.0005;
    lng += (Math.random() - 0.5) * 0.0005;

    setCurrentPos({ lat, lng });

    if (socketRef.current?.connected) {
      socketRef.current.emit("update-location", {
        orderId: currentOrderId,
        driverId,
        lat,
        lng,
        accuracy: 20,
        timestamp: Date.now(),
      });
    }
  }, 3000);
};



  const stopTracking = () => setIsConfirmingStop(true);

  const handleConfirmStop = async () => {
    setIsConfirmingStop(false);
    navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setIsTracking(false);
    setStatusMsg("Delivery completed! Awaiting new order.");

    if (socketRef.current?.connected && currentOrderId && currentPos) {
      socketRef.current.emit("update-location", { orderId: currentOrderId, driverId, lat: currentPos.lat, lng: currentPos.lng });
      socketRef.current.emit("order-delivered", { orderId: currentOrderId, driverId });
    }

    localStorage.removeItem("acceptedOrderId_" + driverId);
    setCurrentOrderId(null);
    setIsOrderAccepted(false);
    await fetchAvailableOrders();
  };

  // =====================
  // RENDER
  // =====================
  if (!isOrderAccepted) {
    return (
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center", mt: 3, px: 2 }}>
        <Paper elevation={8} sx={{ width: "100%", maxWidth: 600, p: 3, borderRadius: 4 }}>
          <Typography variant="h5" fontWeight={700} textAlign="center" mb={3}>📦 Available Orders ({availableOrders.length})</Typography>
          <Divider sx={{ mb: 3 }} />
          {availableOrders.length === 0 ? (
            <Alert severity="info" sx={{ textAlign: 'center' }}>Waiting for new delivery requests...</Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {availableOrders.map((order) => (
                <Card key={order.order_number} variant="outlined" sx={{ p: 1.5 }}>
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="h6" color="primary">Order #{order.order_number}</Typography>
                    <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationOn fontSize="small" /> <strong>Address:</strong> {order.customer?.address || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Item:</strong> {order.type_of_item || 'General'} | <strong>Received:</strong> {new Date(order.createdAt).toLocaleTimeString()}
                    </Typography>
                    <Button variant="contained" color="success" size="small" onClick={() => handleAcceptOrder(order)} sx={{ mt: 1, float: 'right' }}>Accept</Button>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    );
  }

  // ACCEPTED ORDER MAP
  return (
    <Box sx={{ width: "100%", display: "flex", justifyContent: "center", mt: 3, px: 2 }}>
      <Paper elevation={8} sx={{ width: "100%", maxWidth: 600, p: 3, borderRadius: 4 }}>
        <Typography fontWeight={700} variant="h5" textAlign="center" mb={2} sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
          <DirectionsCar sx={{ fontSize: 36, color: "#0ABE51" }} /> Live Driver Tracking
        </Typography>

        <Paper elevation={0} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5, mb: 2, borderRadius: 3,
          background: socketConnected ? "#e6f4ea" : "#ffeaea", border: socketConnected ? "1px solid #4caf50" : "1px solid #f44336" }}>
          <Typography variant="body2" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WifiIcon fontSize="small" color={socketConnected ? "success" : "error"} />{socketConnected ? "Connected" : "Offline"}
          </Typography>
          <Typography variant="body2">{statusMsg}</Typography>
        </Paper>

        <Box sx={{ p: 1.5, mb: 2, borderRadius: 3, background: "#f7f9fc", border: "1px solid #e0e6ed", fontSize: 0.95 }}>
          <Typography><strong>Order ID:</strong> {currentOrderId}</Typography>
          <Typography><strong>Driver ID:</strong> {driverId}</Typography>
          <Typography sx={{ display: "flex", alignItems: "center", gap: 1 }}><GpsFixedIcon fontSize="small" color="primary" /> <strong>Status:</strong> {statusMsg}</Typography>
        </Box>

        <Box sx={{ height: 200, width: "100%", borderRadius: 3, overflow: "hidden", mb: 2 }}>
          {currentPos ? (
            <MapContainer center={currentPos} zoom={16} style={{ height: "100%", width: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapCentering driverPos={currentPos} customerPos={customerPos} />

              <Marker position={currentPos} icon={driverIcon} zIndexOffset={driverZIndex}>
                <Popup>{currentAddress || "Your Location"}</Popup>
              </Marker>

              {customerPos && (
                <Marker position={[customerPos.lat, customerPos.lng]} icon={homeIcon} zIndexOffset={customerZIndex}>
                  <Popup>{customerAddress || "Customer Location"}</Popup>
                </Marker>
              )}

              {currentPos && customerPos && (
                <Polyline positions={[currentPos, [customerPos.lat, customerPos.lng]]} color="blue" dashArray="10,10" opacity={0.6} />
              )}
            </MapContainer>
          ) : (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 1 }}>
              <CircularProgress size={24} />
              <Typography color="textSecondary" fontSize={0.85}>Waiting for GPS…</Typography>
            </Box>
          )}
        </Box>

        <Box display="flex" flexDirection="column" gap={1.5}>
          {!isTracking ? (
            <Button variant="contained" fullWidth color="success" onClick={startTracking} disabled={!isOrderAccepted}>Start Delivery</Button>
          ) : (
            <Button variant="contained" fullWidth color="error" onClick={stopTracking}>Stop Delivery</Button>
          )}
        </Box>

        {/* STOP TRACKING CONFIRMATION */}
        <Dialog open={isConfirmingStop} onClose={() => setIsConfirmingStop(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ color: "error.main", fontWeight: 700 }}><DirectionsCar sx={{ mr: 1 }} /> Confirm Delivery Completion</DialogTitle>
          <Divider />
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 1.5 }}>
              Are you sure you want to mark Order **#{currentOrderId}** as delivered? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsConfirmingStop(false)}>Cancel</Button>
            <Button onClick={handleConfirmStop} color="error" variant="contained">Confirm</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}









