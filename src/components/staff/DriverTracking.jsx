
import { useEffect, useState, useRef , useCallback } from "react";
import {
    Box,
    Button,
    Typography,
    Paper,
    CircularProgress,
    Divider,
    Modal,
    Card,
    CardContent,
    Alert,
    // 🆕 New Imports for Confirmation Dialog
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../api";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WifiIcon from "@mui/icons-material/Wifi";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import { DirectionsCar, LocationOn } from "@mui/icons-material";
import ReactDOMServer from 'react-dom/server';


// const driverIcon = new L.Icon({
//     iconUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097136.png",
//     iconSize: [50, 50],
//     iconAnchor: [25, 25],
//     popupAnchor: [0, -20],
// });

// const homeIcon = new L.Icon({
//     iconUrl: "https://cdn-icons-png.flaticon.com/512/619/619153.png",
//     iconSize: [36, 36],
//     iconAnchor: [18, 36],
//     popupAnchor: [0, -36]
// });


// Function to generate the HTML string for the MUI icon
const createIconMarkup = (IconComponent, color) => {
    // Render the React MUI icon component into an HTML string
    return ReactDOMServer.renderToString(
        <IconComponent sx={{ fontSize: 36, color: color, transform: 'translateY(15%)' }} />
    );
};

// 1. Driver Icon (Car)
const driverIcon = new L.divIcon({
    html: createIconMarkup(DirectionsCar, '#0ABE51'), // Green Car
    className: '', // Remove default Leaflet styling
    iconSize: [36, 36],
    iconAnchor: [18, 36], // Anchor at the bottom center of the icon
    popupAnchor: [0, -36],
});

// 2. Customer Destination Icon (Home/Location Pin)
const homeIcon = new L.divIcon({
    html: createIconMarkup(LocationOn, '#f44336'), // Red Location Pin
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36], // Anchor at the bottom center of the icon
    popupAnchor: [0, -36],
});

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "https://tawsila-backend-0shs.onrender.com";
const userRole = 'driver';

const driverZIndex = userRole === 'driver' ? 1000 : 10;
const customerZIndex = userRole === 'customer' ? 1000 : 10;

export default function DriverTracking({ initialOrderNumber, driverId }) {
    
    // =======================================
    // 1. STATE INITIALIZATION & PERSISTENCE 🛠️
    // =======================================
    
    // 💡 دالة للحصول على القيمة الأولية من Local Storage أو Props
    const getPersistentOrderId = () => {
        // 1. إذا تم تمرير رقم الطلب كـ prop، فاستخدمه (الأولوية للـ prop)
        if (initialOrderNumber) return initialOrderNumber;
        
        // 2. إذا لم يكن موجوداً، استرجع من Local Storage باستخدام Driver ID
        if (driverId) {
            return localStorage.getItem("acceptedOrderId_" + driverId) || null;
        }
        
        return null; // لا يوجد طلب مقبول
    };

    // ⬅️ استدعاء الدالة لتحديد القيمة الأولية **قبل** تعريف الـ State
    const initialAcceptedOrderId = getPersistentOrderId();
    
    // 🆕 حالة جديدة لحفظ قائمة الطلبات المتاحة التي تم جلبها من DB
    const [availableOrders, setAvailableOrders] = useState([]);    
    const [isTracking, setIsTracking] = useState(false);
    const [currentPos, setCurrentPos] = useState(null);
    const [statusMsg, setStatusMsg] = useState("Ready…");
    const [socketConnected, setSocketConnected] = useState(false);
    // حول السطر 104 في قسم تهيئة الحالة (STATE INITIALIZATION)
    const [customerPos, setCustomerPos] = useState(null);
    const [position, setPosition] = useState(null);
    const [accuracy, setAccuracy] = useState(null);
    const [error, setError] = useState(null);
    
    // حالة للطلب اللحظي (Modal notification)
    const [newOrder, setNewOrder] = useState(null);    
    
    // ⬅️ استخدام القيمة المسترجعة كقيمة أولية للحالات
    const [currentOrderId, setCurrentOrderId] = useState(initialAcceptedOrderId);
    const [isOrderAccepted, setIsOrderAccepted] = useState(!!initialAcceptedOrderId);
    
    // 🆕 حالة جديدة لإدارة ظهور نافذة تأكيد إيقاف التتبع
    const [isConfirmingStop, setIsConfirmingStop] = useState(false); // <-- ADDED
    
    // =======================================
    // 2. REFS
    // =======================================
    
    const watchIdRef = useRef(null);
    const socketRef = useRef(null);
    



    // =======================================
// 5. ACTION HANDLERS
// =======================================

// 🆕 الدالة المساعدة لجلب موقع العميل - مغلفة بـ useCallback
const fetchCustomerLocation = useCallback(async (orderId) => {
    try {
        // استخدم orderId المُمرر، وليس currentOrderId
        const response = await api.get(`/public/order/track/${orderId}`);
        const customerCoords = response.data.customer.coords;

        if (customerCoords && customerCoords.lat && customerCoords.lng) {
            setCustomerPos(customerCoords);
        }
    } catch (error) {
        console.error("Error fetching customer location:", error);
    }
}, [setCustomerPos]); // تعتمد على setCustomerPos فقط

    // =======================================
    // 3. FETCHING DATA (Initial Load)
    // =======================================

    // دالة لجلب الطلبات المتاحة من قاعدة البيانات عند التحميل
    const fetchAvailableOrders = async () => {
        if (!driverId) return;

        try {
            const res = await api.get(`/orders/orders/available`);    
            
            if (res.data && res.data.orders) {
                console.log("Found available orders:", res.data.orders);
                // تصفية الطلب الحالي إذا كان لا يزال موجوداً في القائمة (لتجنب التكرار)
                const filteredOrders = res.data.orders.filter(
                    order => order.order_number !== currentOrderId
                );
                setAvailableOrders(filteredOrders); 
            }
        } catch (error) {
            console.error("Error fetching available orders:", error);
            setStatusMsg(`Error: Failed to fetch orders. ${error.message}`);
        }
    };


    const watchPosition = useCallback(() => {
  if (!navigator.geolocation) {
    setError("Geolocation not supported by your browser");
    return;
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setAccuracy(accuracy);

      // تجاهل المواقع منخفضة الدقة (أكثر من 30 متر)
      if (accuracy <= 30) {
        setPosition({ lat: latitude, lng: longitude });
      } else {
        console.warn(`Low accuracy (${accuracy}m), waiting for better GPS...`);
      }
    },
    (err) => {
      console.error(err);
      setError(err.message);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}, []);


useEffect(() => {
  // استدعاء watchPosition وتخزين الـ cleanup
  const cleanup = watchPosition(); 

  // تنظيف الـ watcher عند فك المكون
  return cleanup;
}, [watchPosition]);

    
    // يتم استدعاء دالة الجلب عند تحميل المكون
    useEffect(() => {
        // إذا كان هناك طلب مقبول مسبقاً، لا داعي لجلب القائمة
        if (!isOrderAccepted) {
            fetchAvailableOrders();
        }
    }, [driverId, isOrderAccepted, currentOrderId]); // إضافة currentOrderId للـ dependencies

    // =======================================
    // 4. SOCKET.IO SETUP (Real-Time)
    // =======================================

    useEffect(() => {
        if (!driverId) {
            setStatusMsg("Error: Driver ID is missing.");
            return;
        }

        const socket = io(SOCKET_URL);
        socketRef.current = socket;

        socket.on("connect", () => {
            setSocketConnected(true);
            setStatusMsg("Connected ✔ Ready to receive orders");
            socket.emit("driver-join", driverId);    
        });

        const handleNewOrder = (orderData) => {
            console.log("🔥 RECEIVED NEW ORDER VIA SOCKET:", orderData);
            // إضافة الطلب الجديد إلى القائمة فقط إذا لم يكن مقبولاً بالفعل
            if (!isOrderAccepted && orderData.order_number !== currentOrderId) {
                setAvailableOrders(prevOrders => [orderData, ...prevOrders]);
                // وعرض الـ Modal كإشعار لحظي
                setNewOrder(orderData);    
            }
        };

        socket.on("new-order", handleNewOrder); 
        
        socket.on("order-accepted", (data) => {
            // إزالة الطلب من قائمة الطلبات المتاحة إذا قبله سائق آخر
            setAvailableOrders(prevOrders =>    
                prevOrders.filter(order => order.order_number !== data.order_number)
            );
            
            if (newOrder && newOrder.order_number === data.order_number) {
                setNewOrder(null);    
                alert(`Order #${data.order_number}  accepted by driver.`);
            }
        });

        socket.on("disconnect", () => {
            setSocketConnected(false);
            setStatusMsg("Disconnected… Reconnecting");
        });

        return () => {
            socket.off("new-order", handleNewOrder);
            socket.off("order-accepted");
            socket.disconnect();
        };
    }, [driverId, isOrderAccepted, newOrder, currentOrderId]); // إضافة currentOrderId للـ dependencies


  



useEffect(() => {
    // Fetches static customer coordinates when an order is accepted
    if (currentOrderId && isOrderAccepted) {
        fetchCustomerLocation(currentOrderId);
    }
}, [currentOrderId, isOrderAccepted, fetchCustomerLocation]);


// Add this new effect after your state initialization section:

// =======================================
// 7. NEW EFFECT: AUTO-RESUME DRIVER TRACKING 🚀
// =======================================
useEffect(() => {
    // If an order was accepted (from local storage/props)
    // AND tracking is currently NOT active, resume tracking.
    if (isOrderAccepted && !isTracking) {
        setStatusMsg("Resuming tracking for accepted order...");
        
        // Use a slight delay to ensure the component has fully rendered 
        // and states are settled before accessing the Geolocation API.
        const timer = setTimeout(() => {
            // This function initiates the GPS watchPosition loop.
            startTracking();
        }, 100); 

        return () => clearTimeout(timer); // Cleanup timer if component unmounts quickly
    }
    // Dependency array ensures this only runs when tracking state changes 
    // or when an order is initially deemed accepted.
}, [isOrderAccepted, isTracking]); 

// ---
// Your existing useEffect (no changes needed here):

useEffect(() => {
    // 1. متى يجب أن يتم الجلب؟ عندما يتوفر رقم الطلب الحالي
    if (currentOrderId && isOrderAccepted) {
        
        // 🚀 استدعاء الدالة المساعدة مباشرةً باستخدام رقم الطلب
        fetchCustomerLocation(currentOrderId);
    }
}, [currentOrderId, isOrderAccepted, fetchCustomerLocation]);



function MapCentering({ driverPos, customerPos }) {
    const map = useMap();

    useEffect(() => {
        if (driverPos && customerPos) {
            // إذا كان موقع السائق والعميل معروفاً، قم بضبط عرض الخريطة ليشمل كلاهما
            const bounds = L.latLngBounds([driverPos, [customerPos.lat, customerPos.lng]]);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        } else if (driverPos) {
            // إذا كان موقع السائق فقط معروفاً، قم بالتركيز عليه
            map.setView(driverPos, map.getZoom() < 14 ? 14 : map.getZoom());
        }
    }, [map, driverPos, customerPos]);

    return null;
}
    
    // =======================================
    // 5. ACTION HANDLERS
    // =======================================

    // const handleAcceptOrder = async (orderToAccept) => {
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

    const handleAcceptOrder = async (orderToAccept) => {
    const orderNumber = orderToAccept.order_number;
    
    try {
        setStatusMsg(`Accepting order #${orderNumber}...`);
        const res = await api.post("/orders/accept", {
            order_number: orderNumber,
            driver_id: driverId,
        });

        if (res.status === 200 || res.status === 201) {
            // 🚀 الحفظ في Local Storage
            localStorage.setItem("acceptedOrderId_" + driverId, orderNumber);
            
            setCurrentOrderId(orderNumber);
            setIsOrderAccepted(true);
            setNewOrder(null);
            
            // 🆕 💡 الخطوة الجديدة: جلب موقع العميل فوراً وتحديث الحالة
            if (orderToAccept.customer && orderToAccept.customer.coords) {
                const customerCoords = orderToAccept.customer.coords;
                // يجب أن يكون الكائن customerPos { lat: X, lng: Y }
                setCustomerPos({ lat: customerCoords.lat, lng: customerCoords.lng }); 
            } else {
                // إذا لم يتم تمرير الإحداثيات في كائن الطلب، يجب جلبها عبر API
                // هذا يضمن ظهور موقع العميل حتى لو لم يكن متاحاً في كائن الطلب الأولي
                await fetchCustomerLocation(orderNumber);
            }
            
            // إزالة الطلب المقبول من قائمة الطلبات المتاحة
            setAvailableOrders(prevOrders => 
                prevOrders.filter(order => order.order_number !== orderNumber)
            );
            
            setStatusMsg(`Order #${orderNumber} accepted! Start tracking.`);
        }
    } catch (error) {
        console.error("Error accepting order:", error);
        const errMsg = error.response?.data?.error || "Acceptance failed!";
        setStatusMsg(`Failed to accept order: ${errMsg}`);
        alert(errMsg);
    }
};

    // const startTracking = () => {
    //     if (!navigator.geolocation) {
    //         alert("Your device does not support GPS.");
    //         return;
    //     }
    //     if (!isOrderAccepted) {
    //         alert("Please accept an order first.");
    //         return;
    //     }

    //     setIsTracking(true);
    //     setStatusMsg("Sending live location…");

    //     const orderToTrack = currentOrderId; // نستخدم currentOrderId الذي تم تهيئته

    //     watchIdRef.current = navigator.geolocation.watchPosition(
    //         (pos) => {
    //             const { latitude, longitude } = pos.coords;
    //             setCurrentPos([latitude, longitude]);

    //             if (socketRef.current?.connected && orderToTrack) {
    //                 socketRef.current.emit("update-location", {
    //                     orderId: orderToTrack,
    //                     driverId,
    //                     lat: latitude,
    //                     lng: longitude,
    //                 });
    //             }
    //         },
    //         (err) => setStatusMsg("GPS Error: " + err.message),
    //         { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    //     );
    // };

    // 💡 First step: only open the confirmation dialog
  
  
const startTracking = () => {
    if (!navigator.geolocation) {
        alert("Your device does not support GPS.");
        return;
    }
    if (!isOrderAccepted) {
        alert("Please accept an order first.");
        return;
    }

    // 1. Clear any previous tracking instance before starting a new one (safety)
    if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
    }
    
    setIsTracking(true);
    setStatusMsg("Sending live location…");

    const orderToTrack = currentOrderId;

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, accuracy } = pos.coords; 
            
            // 💡 FILTER: Skip sending updates if accuracy is worse than 100 meters
            if (accuracy > 100) {
                setStatusMsg(`Warning: Low accuracy (${accuracy.toFixed(0)}m). Waiting for better GPS signal.`);
                return; // Skip sending inaccurate updates
            }

            setCurrentPos([latitude, longitude]);

            if (socketRef.current?.connected && orderToTrack) {
                socketRef.current.emit("update-location", {
                    orderId: orderToTrack,
                    driverId,
                    lat: latitude,
                    lng: longitude,
                    accuracy: accuracy, 
                });
            }
        },
        // 2. 🚨 Enhanced Error Handling Callback
        (err) => {
            let errorMsg = "GPS Error: ";
            switch (err.code) {
                case err.PERMISSION_DENIED:
                    errorMsg += "Access Denied. Please check browser permissions.";
                    break;
                case err.POSITION_UNAVAILABLE:
                    errorMsg += "Position Unavailable. Check GPS/Network signal.";
                    break;
                case err.TIMEOUT:
                    // Timeout often means the device couldn't get a high-accuracy fix in time.
                    errorMsg += "Timeout (5s). Signal too weak or device busy."; // ✅ CORRECTED TIMEOUT MESSAGE
                    break;
                default:
                    errorMsg += err.message;
            }
            console.error("Geolocation Error:", errorMsg, err);
            setStatusMsg(errorMsg);
            
            // 🛑 Stop tracking on fatal/persistent errors
            if (watchIdRef.current) {
                 navigator.geolocation.clearWatch(watchIdRef.current);
                 setIsTracking(false);
                 watchIdRef.current = null;
                 alert("Location tracking stopped due to error: " + errorMsg);
            }
        },
        // 3. ⚙️ Optimized Configuration Options
        { 
            enableHighAccuracy: true, 
            maximumAge: 0, 
            timeout: 20000 
        } 
    );
};
  
    const stopTracking = () => {
        setIsConfirmingStop(true);
    };
    
    // 🚀 Second step: actual delivery completion logic (runs on confirmation)
    const handleConfirmStop = async () => {
        // 1. Close confirmation dialog
        setIsConfirmingStop(false);

        // 2. إيقاف تتبع الموقع
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setIsTracking(false);
        setStatusMsg("Delivery completed! Awaiting new order.");

        const orderToTrack = currentOrderId;

        if (socketRef.current?.connected && orderToTrack) {
            // إرسال آخر موقع مؤكد للتسليم
            if (currentPos) {
                socketRef.current.emit("update-location", {
                    orderId: orderToTrack,
                    driverId,
                    lat: currentPos[0],
                    lng: currentPos[1],
                });
            }

            // إرسال الحدث الجديد للتسليم
            socketRef.current.emit("order-delivered", {
                orderId: orderToTrack,
                driverId,
            });

            // 🚀 الحذف من Local Storage
            localStorage.removeItem("acceptedOrderId_" + driverId);

            // إعادة تعيين الحالة للبدء من جديد
            setCurrentOrderId(null);
            setIsOrderAccepted(false);

            // إعادة جلب الطلبات المتاحة
            await fetchAvailableOrders();
        }
    };
    
    // =======================================
    // 6. RENDERING LOGIC
    // =======================================
    
    const renderAvailableOrdersList = () => (
        <Paper 
            elevation={8} 
            sx={{ width: "100%", maxWidth: 600, p: 3, borderRadius: 4 }}
        >
            <Typography variant="h5" fontWeight={700} textAlign="center" mb={3}>
                📦 Available Orders ({availableOrders.length})
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {availableOrders.length === 0 ? (
                <Alert severity="info" sx={{ textAlign: 'center' }}>
                    Waiting for new delivery requests...
                </Alert>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {availableOrders.map((order) => (
                        <Card key={order.order_number} variant="outlined" sx={{ p: 1.5 }}>
                            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                <Typography variant="h6" color="primary">Order #{order.order_number}</Typography>
                                <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <LocationOn fontSize="small" />    
                                    <strong>Address:</strong> {order.customer?.address || 'N/A'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>Item:</strong> {order.type_of_item || 'General'} | <strong>Received:</strong> {new Date(order.createdAt).toLocaleTimeString()}
                                </Typography>
                                <Button    
                                    variant="contained"    
                                    color="success"    
                                    size="small"    
                                    onClick={() => handleAcceptOrder(order)}
                                    sx={{ mt: 1, float: 'right' }}
                                >
                                    Accept
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </Box>
            )}
        </Paper>
    );

    // الوظيفة الرئيسية: إما عرض قائمة الطلبات أو واجهة التتبع
    if (!isOrderAccepted) {
        return (
            <Box
                sx={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    mt: { xs: 2, sm: 3 },
                    px: { xs: 1, sm: 2 },
                }}
            >
                {renderAvailableOrdersList()}

                {/* New Order Modal (يبقى كما هو للإشعارات اللحظية) */}
                <Modal open={!!newOrder} onClose={() => setNewOrder(null)}>
                    <Paper    
                        sx={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: { xs: "85%", sm: 400 },
                            p: { xs: 2, sm: 3 },
                            textAlign: "center",
                            borderRadius: 3,
                        }}
                    >
                        <Typography variant="h6" fontWeight={700} color="primary" mb={2}>
                            <CheckCircleIcon fontSize="small" sx={{ mr: 1 }} /> New Delivery Request
                        </Typography>

                        {newOrder && (
                            <Box textAlign="left" mb={2} sx={{ bgcolor: "#f5f5f5", p: 2, borderRadius: 2 }}>
                                <Typography variant="body2"><strong>Order ID:</strong> {newOrder.order_number}</Typography>
                                <Typography variant="body2"><strong>Item Type:</strong> {newOrder.type_of_item}</Typography>
                                <Typography variant="body2" sx={{ wordWrap: "break-word" }}>
                                    <strong>Address:</strong> {newOrder.customer_address || newOrder.customer?.address}
                                </Typography>
                            </Box>
                        )}

                        <Button    
                            variant="contained"    
                            color="success"    
                            fullWidth    
                            onClick={() => handleAcceptOrder(newOrder)}
                            sx={{ py: 1.5, fontSize: "0.95rem", fontWeight: 600, mb: 1 }}
                        >
                            Accept Order
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            fullWidth
                            onClick={() => setNewOrder(null)}
                            sx={{ py: 1.5, fontWeight: 600 }}
                        >
                            Decline
                        </Button>
                    </Paper>
                </Modal>
            </Box>
        );
    }
    
    // العرض في حالة قبول الطلب
    return (
        <Box
            sx={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                mt: { xs: 2, sm: 3 },
                px: { xs: 1, sm: 2 },
            }}
        >
            <Paper
                elevation={8}
                sx={{
                    width: "100%",
                    maxWidth: 600,    
                    p: { xs: 2, sm: 3 },
                    borderRadius: 4,
                    background: "#ffffff",
                    boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
                }}
            >
                {/* Header, Status, Info Sections */}
                
                <Typography
                    fontWeight={700}
                    variant="h5"
                    textAlign="center"
                    mb={2}
                    sx={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
                        fontSize: { xs: "1.2rem", sm: "1.5rem", md: "1.8rem" },
                    }}
                >
                    <DirectionsCar sx={{ fontSize: { xs: 28, sm: 32, md: 36 }, color: "#0ABE51" }} />
                    Live Driver Tracking
                </Typography>

                <Paper
                    elevation={0}
                    sx={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5, mb: 2, borderRadius: 3,
                        background: socketConnected ? "#e6f4ea" : "#ffeaea",
                        border: socketConnected ? "1px solid #4caf50" : "1px solid #f44336",
                    }}
                >
                    <Typography
                        variant="body2" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                        <WifiIcon fontSize="small" color={socketConnected ? "success" : "error"} />
                        {socketConnected ? "Connected" : "Offline"}
                    </Typography>
                    <Typography variant="body2">{statusMsg}</Typography>
                </Paper>

                <Box
                    sx={{
                        p: 1.5, mb: 2, borderRadius: 3, background: "#f7f9fc", border: "1px solid #e0e6ed",
                        fontSize: { xs: "0.8rem", sm: "0.9rem", md: "0.95rem" },
                    }}
                >
                    <Typography><strong>Order ID:</strong> {currentOrderId}</Typography>
                    <Typography><strong>Driver ID:</strong> {driverId}</Typography>
                    <Typography sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <GpsFixedIcon fontSize="small" color="primary" /> <strong>Status:</strong> {statusMsg}
                    </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Map Section */}
                <Box
                    sx={{
                        height: { xs: 150, sm: 180, md: 200 }, width: "100%", borderRadius: 3, overflow: "hidden", mb: 2, border: "1px solid #ddd", mx: "auto",
                    }}
                >
                    {currentPos ? (
                 
                 
                 <MapContainer center={currentPos} zoom={16} style={{ height: "100%", width: "100%" }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                            <MapCentering 
                                    driverPos={currentPos} 
                                    customerPos={customerPos} 
                                />
                            <Marker position={currentPos} icon={driverIcon}
                            zIndexOffset={driverZIndex}
                            >
                                <Popup>Your Location</Popup>
                            </Marker>

                            {/* إضافة خط المسار بين السائق والعميل */}
                            {currentPos && customerPos && (
                            <Polyline
                            // يربط بين [موقع السائق] و [موقع العميل]
                            positions={[currentPos, [customerPos.lat, customerPos.lng]]}
                            color="blue" dashArray="10,10" opacity={0.6}
                            />
                            )}


                           {customerPos && (
                                <Marker 
                                    position={[customerPos.lat, customerPos.lng]} 
                                    icon={homeIcon} // 👍 هذه هي علامة العميل
                                    zIndexOffset={customerZIndex}
                                >
                                    <Popup>Customer Pickup Location</Popup>
                                </Marker>
                            )}
                            
                            {/* ❓ يجب أن تكون علامة منزل العميل هنا! */}
                        </MapContainer>
                        
                    ) : (
                        <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", flexDirection: "column", gap: 1, }}>
                            <CircularProgress size={24} />
                            <Typography color="textSecondary" fontSize="0.85rem">
                                Waiting for GPS…
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Buttons */}
                <Box display="flex" flexDirection={{ xs: "column", sm: "row" }} gap={1.5}>
                    {!isTracking ? (
                        <Button
                            variant="contained" fullWidth color="success" onClick={startTracking} size="large"
                            disabled={!isOrderAccepted}
                            sx={{ py: 1.6, fontSize: { xs: "0.9rem", sm: "1rem" }, borderRadius: 3, fontWeight: 600, }}
                        >
                            Start Delivery
                        </Button>
                    ) : (
                        <Button
                            // 💡 Changed onClick to trigger the confirmation dialog
                            variant="contained" fullWidth color="error" onClick={stopTracking} size="large"
                            sx={{ py: 1.6, fontSize: { xs: "0.9rem", sm: "1rem" }, borderRadius: 3, fontWeight: 600, }}
                        >
                            Stop Delivery
                        </Button>
                    )}
                </Box>
            </Paper>

            {/* 🛑 STOP TRACKING CONFIRMATION DIALOG 🛑 */}
            <Dialog
                open={isConfirmingStop}
                onClose={() => setIsConfirmingStop(false)}
                aria-labelledby="stop-tracking-dialog-title"
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle id="stop-tracking-dialog-title" sx={{ color: "error.main", fontWeight: 700 }}>
                    <DirectionsCar sx={{ mr: 1 }} /> Confirm Delivery Completion
                </DialogTitle>
                <Divider />
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 1.5 }}>
                        Are you sure you want to mark Order **#{currentOrderId}** as **Delivered** and stop sending your location?
                    </Typography>
                    <Alert severity="warning">
                        This action is irreversible for the current order, clears your local data, and will prepare you for a new assignment.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button
                        onClick={() => setIsConfirmingStop(false)}
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmStop} // 🚀 Calls the final delivery logic
                        color="error"
                        variant="contained"
                        autoFocus
                        sx={{ fontWeight: 600 }}
                    >
                        Confirm Stop Tracking
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// import { useEffect, useState, useRef } from "react";
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
// } from "@mui/material";
// import { io } from "socket.io-client";
// import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
// import "leaflet/dist/leaflet.css";
// import L from "leaflet";
// import api from "../api";
// import CheckCircleIcon from "@mui/icons-material/CheckCircle";
// import WifiIcon from "@mui/icons-material/Wifi";
// import GpsFixedIcon from "@mui/icons-material/GpsFixed";
// import { DirectionsCar, LocationOn } from "@mui/icons-material";

// const driverIcon = new L.Icon({
//     iconUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097136.png",
//     iconSize: [50, 50],
//     iconAnchor: [25, 25],
//     popupAnchor: [0, -20],
// });

// const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

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
    
//     // حالة للطلب اللحظي (Modal notification)
//     const [newOrder, setNewOrder] = useState(null);    
    
//     // حالة لقبول الطلب
//     const [currentOrderId, setCurrentOrderId] = useState(initialAcceptedOrderId);
//     const [isOrderAccepted, setIsOrderAccepted] = useState(!!initialAcceptedOrderId);
//     const [isConfirmingStop, setIsConfirmingStop] = useState(false);


//     const watchIdRef = useRef(null);
//     const socketRef = useRef(null);
    
//     // =======================================
//     // 1. FETCHING DATA (Initial Load)
//     // =======================================

//     // 🆕 دالة لجلب الطلبات المتاحة من قاعدة البيانات عند التحميل
//     const fetchAvailableOrders = async () => {
//         if (!driverId) return;

//         try {
//             // 🚨 نستخدم المسار الصحيح المتفق عليه سابقاً
//             const res = await api.get(`/orders/orders/available`);    
            
//             if (res.data && res.data.orders) {
//                 console.log("Found available orders:", res.data.orders);
//                 setAvailableOrders(res.data.orders); // ⬅️ يتم تخزين القائمة في الحالة الجديدة
//             }
//         } catch (error) {
//             console.error("Error fetching available orders:", error);
//             // قد يكون خطأ CORS أو خطأ خادم. نعرض تنبيهًا
//             setStatusMsg(`Error: Failed to fetch orders. ${error.message}`);
//         }
//     };
    
//     // 2️⃣ يتم استدعاء دالة الجلب عند تحميل المكون
//     useEffect(() => {
//         // إذا كان هناك طلب مقبول مسبقاً، لا داعي لجلب القائمة
//         if (!isOrderAccepted) {
//             fetchAvailableOrders();
//         }
//     }, [driverId, isOrderAccepted]);



//     // =======================================
//     // 2. SOCKET.IO SETUP (Real-Time)
//     // =======================================

//     useEffect(() => {
//         if (!driverId) {
//             setStatusMsg("Error: Driver ID is missing.");
//             return;
//         }

//         const socket = io(SOCKET_URL);
//         socketRef.current = socket;

//         socket.on("connect", () => {
//             setSocketConnected(true);
//             setStatusMsg("Connected ✔ Ready to receive orders");
//             socket.emit("driver-join", driverId);    
//         });

//         const handleNewOrder = (orderData) => {
//             console.log("🔥 RECEIVED NEW ORDER VIA SOCKET:", orderData);
//             // 🚨 يتم تحديث قائمة الطلبات المتاحة بطلب جديد (لاستمرارية البيانات)
//             setAvailableOrders(prevOrders => [orderData, ...prevOrders]);
            
//             // وعرض الـ Modal كإشعار لحظي
//             if (!isOrderAccepted) setNewOrder(orderData);    
//         };

//         socket.on("new-order", handleNewOrder); // 🚨 اسم الحدث يجب أن يتطابق مع الخلفية
        
//         socket.on("order-accepted", (data) => {
//             // إزالة الطلب من قائمة الطلبات المتاحة إذا قبله سائق آخر
//             setAvailableOrders(prevOrders =>    
//                 prevOrders.filter(order => order.order_number !== data.order_number)
//             );
            
//             if (newOrder && newOrder.order_number === data.order_number) {
//                 setNewOrder(null);    
//                 alert(`Order #${data.order_number} was accepted by another driver.`);
//             }
//         });

//         socket.on("disconnect", () => {
//             setSocketConnected(false);
//             setStatusMsg("Disconnected… Reconnecting");
//         });

//         return () => {
//             socket.off("new-order-available", handleNewOrder);
//             socket.off("order-accepted");
//             socket.disconnect();
//         };
//     }, [driverId, isOrderAccepted, newOrder]);
    
//     // =======================================
//     // 3. ACTION HANDLERS
//     // =======================================

//     const handleAcceptOrder = async (orderToAccept) => {
//         const orderNumber = orderToAccept.order_number;
        
//         try {
//             setStatusMsg(`Accepting order #${orderNumber}...`);
//             const res = await api.post("/orders/accept", {
//                 order_number: orderNumber,
//                 driver_id: driverId,
//             });

//             if (res.status === 200 || res.status === 201) {

//                 localStorage.setItem("acceptedOrderId_" + driverId, orderNumber);
//                 setCurrentOrderId(orderNumber);
//                 setIsOrderAccepted(true);
//                 setNewOrder(null);
                
//                 // 🆕 إزالة الطلب المقبول من قائمة الطلبات المتاحة
//                 setAvailableOrders(prevOrders =>    
//                     prevOrders.filter(order => order.order_number !== orderNumber)
//                 );
                
//                 setStatusMsg(`Order #${orderNumber} accepted! Start tracking.`);
//             }
//         } catch (error) {
//             console.error("Error accepting order:", error);
//             const errMsg = error.response?.data?.error || "Acceptance failed!";
//             setStatusMsg(`Failed to accept order: ${errMsg}`);
//             alert(errMsg);
//         }
//     };

//     const startTracking = () => {
//         // ... (وظيفة التتبع تبقى كما هي)
//         if (!navigator.geolocation) {
//             alert("Your device does not support GPS.");
//             return;
//         }
//         if (!isOrderAccepted && !initialOrderNumber) {
//             alert("Please accept an order first or ensure an order ID is provided.");
//             return;
//         }

//         setIsTracking(true);
//         setStatusMsg("Sending live location…");

//         const orderToTrack = currentOrderId || initialOrderNumber;

//         watchIdRef.current = navigator.geolocation.watchPosition(
//             (pos) => {
//                 const { latitude, longitude } = pos.coords;
//                 setCurrentPos([latitude, longitude]);

//                 if (socketRef.current?.connected && orderToTrack) {
//                     socketRef.current.emit("update-location", {
//                         orderId: orderToTrack,
//                         driverId,
//                         lat: latitude,
//                         lng: longitude,
//                     });
//                 }
//             },
//             (err) => setStatusMsg("GPS Error: " + err.message),
//             { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
//         );
//     };

//     // 🚀 التعديل الرئيسي: إرسال إشعار التسليم وإعادة تعيين الحالة

    
//     // const stopTracking = async () => {
//     //     // 1. إيقاف تتبع الموقع
//     //     navigator.geolocation.clearWatch(watchIdRef.current);
//     //     watchIdRef.current = null;
//     //     setIsTracking(false);
//     //     setStatusMsg("Delivery completed! Awaiting new order.");

//     //     const orderToTrack = currentOrderId || initialOrderNumber;
        
//     //     if (socketRef.current?.connected && orderToTrack) {
//     //         // إرسال آخر موقع مؤكد للتسليم
//     //         if (currentPos) {
//     //             socketRef.current.emit("update-location", {
//     //                 orderId: orderToTrack,
//     //                 driverId,
//     //                 lat: currentPos[0],
//     //                 lng: currentPos[1],
//     //             });
//     //         }

            

//     //         // 🚨 إرسال الحدث الجديد للتسليم
//     //         socketRef.current.emit("order-delivered", {
//     //             orderId: orderToTrack,
//     //             driverId,
//     //         });

//     //         // 🚨 الخطوة الإضافية: حذف من Local Storage عند إنهاء الطلب
//     //        localStorage.removeItem("acceptedOrderId_" + driverId);
            
//     //         // إعادة تعيين الحالة للبدء من جديد
//     //         setCurrentOrderId(null);
//     //         setIsOrderAccepted(false);

//     //         // إعادة جلب الطلبات المتاحة (للتأكد من ظهورها في القائمة)
//     //         // نستخدم await للتأكد من اكتمال الجلب قبل إظهار الواجهة
//     //         await fetchAvailableOrders(); 
//     //     }
//     // };
    
//     // =======================================
//     // 4. RENDERING LOGIC (فصل عرض الطلبات عن التتبع)
//     // =======================================

//     // ... (باقي كود renderAvailableOrdersList و Return يبقى كما هو)
    
//     // 🆕 وظيفة مساعدة لعرض الطلبات المتاحة
    
//     const stopTracking = () => {
//   setIsConfirmingStop(true);
// };

// // 🚀 ACTUAL delivery completion logic, called ONLY after confirmation
// const handleConfirmStop = async () => {
//   // 1. إغلاق نافذة التأكيد
//   setIsConfirmingStop(false);

//   // 2. إيقاف تتبع الموقع
//   navigator.geolocation.clearWatch(watchIdRef.current);
//   watchIdRef.current = null;
//   setIsTracking(false);
//   setStatusMsg("Delivery completed! Awaiting new order.");

//   const orderToTrack = currentOrderId;

//   if (socketRef.current?.connected && orderToTrack) {
//     // إرسال آخر موقع مؤكد للتسليم
//     if (currentPos) {
//       socketRef.current.emit("update-location", {
//         orderId: orderToTrack,
//         driverId,
//         lat: currentPos[0],
//         lng: currentPos[1],
//       });
//     }

//     // إرسال الحدث الجديد للتسليم
//     socketRef.current.emit("order-delivered", {
//       orderId: orderToTrack,
//       driverId,
//     });

//     // 🚀 الحذف من Local Storage
//     localStorage.removeItem("acceptedOrderId_" + driverId);

//     // إعادة تعيين الحالة للبدء من جديد
//     setCurrentOrderId(null);
//     setIsOrderAccepted(false);

//     // إعادة جلب الطلبات المتاحة
//     await fetchAvailableOrders();
//   }
// };

    
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
//                                     **Address:** {order.customer?.address || 'N/A'}
//                                 </Typography>
//                                 <Typography variant="body2" color="text.secondary">
//                                     **Item:** {order.type_of_item || 'General'} | **Received:** {new Date(order.createdAt).toLocaleTimeString()}
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

//     // 🆕 الوظيفة الرئيسية: إما عرض قائمة الطلبات أو واجهة التتبع
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
//                             onClick={() => handleAcceptOrder(newOrder)} // 🚨 تمرير الطلب نفسه
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
    
//     // ↩️ العرض في حالة قبول الطلب (باقي الكود الأصلي)
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
//                 {/* Header, Status, Info Sections (Keep these as they are) */}
                
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
//                     <Typography><strong>Order ID:</strong> {currentOrderId || initialOrderNumber}</Typography>
//                     <Typography><strong>Driver ID:</strong> {driverId}</Typography>
//                     <Typography sx={{ display: "flex", alignItems: "center", gap: 1 }}>
//                         <GpsFixedIcon fontSize="small" color="primary" /> <strong>Status:</strong> {statusMsg}
//                     </Typography>
//                 </Box>

//                 <Divider sx={{ my: 2 }} />

//                 {/* Map Section (Keep this as it is) */}
//                 <Box
//                     sx={{
//                         height: { xs: 150, sm: 180, md: 200 }, width: "100%", borderRadius: 3, overflow: "hidden", mb: 2, border: "1px solid #ddd", mx: "auto",
//                     }}
//                 >
//                     {currentPos ? (
//                         <MapContainer center={currentPos} zoom={16} style={{ height: "100%", width: "100%" }}>
//                             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
//                             <Marker position={currentPos} icon={driverIcon}>
//                                 <Popup>Your Location</Popup>
//                             </Marker>
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

//                 {/* Buttons (Keep these as they are) */}
//                 <Box display="flex" flexDirection={{ xs: "column", sm: "row" }} gap={1.5}>
//                     {!isTracking ? (
//                         <Button
//                             variant="contained" fullWidth color="success" onClick={startTracking} size="large"
//                             disabled={!isOrderAccepted && !initialOrderNumber} // 🚨 استخدام initialOrderNumber
//                             sx={{ py: 1.6, fontSize: { xs: "0.9rem", sm: "1rem" }, borderRadius: 3, fontWeight: 600, }}
//                         >
//                             Start Delivery
//                         </Button>
//                     ) : (
//                         <Button
//                             variant="contained" fullWidth color="error" onClick={stopTracking} size="large"
//                             sx={{ py: 1.6, fontSize: { xs: "0.9rem", sm: "1rem" }, borderRadius: 3, fontWeight: 600, }}
//                         >
//                             Stop Delivery
//                         </Button>
//                     )}
//                 </Box>
//             </Paper>
//         </Box>
//     );
// }









