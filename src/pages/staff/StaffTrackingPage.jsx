import { Box, Typography } from "@mui/material";
import DriverTracking from "../../components/staff/DriverTracking"; 

export default function StaffTrackingPage() {
  
  const driverId = localStorage.getItem("driverId");

  const currentOrderNumber = null;

  return (
    <Box>
      <Typography variant="h5" mb={3}>
        Tracking Center
      </Typography>

      <DriverTracking 
        orderNumber={currentOrderNumber}
        driverId={driverId}   
      />
    </Box>
  );
}
