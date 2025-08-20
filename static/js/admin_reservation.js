 document.addEventListener('DOMContentLoaded', function() {
    lucide.createIcons();
    // Global variables
    let selectedDeviceId = null;
    let bookedDevicesData = [];
    let allDevicesData = [];
    let startTime = '';
    let endTime = '';
    let currentFilter = '';
    

    // DOM elements
    const bookReservationBtn = document.getElementById('bookReservationBtn');
    const deviceSelectionOverlay = document.getElementById('deviceSelectionOverlay');
    const closeOverlayBtns = document.querySelectorAll('.close-overlay');
    const deviceTabs = document.querySelectorAll('.device-tab');
    const availableDevicesTab = document.getElementById('available-devices');
    const bookedDevicesTab = document.getElementById('booked-devices');
    const bookedDevicesTable = document.getElementById('bookedDevicesTable');
    const cancelToast = document.getElementById('cancelToast');
    const toastMessage = document.getElementById('toastMessage');

            const startTimePicker = flatpickr("#start_time", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    minDate: "today",
    time_24hr: true,
    minuteIncrement: 1,
    defaultHour: new Date().getHours(),
    defaultMinute: 0,
    utc: true,
    onReady: function(selectedDates, dateStr, instance) {
        instance.element.placeholder = "Select start time (hh:mm)";
    },
    onChange: function(selectedDates, dateStr) {
        // Update the end time minimum date when start time changes
        endTimePicker.set('minDate', dateStr);
        // If end time is before new start time, reset it
        if (endTimePicker.selectedDates[0] && endTimePicker.selectedDates[0] <= selectedDates[0]) {
            const newEndDate = new Date(selectedDates[0].getTime() + 60 * 60 * 1000); // +1 hour
            endTimePicker.setDate(newEndDate);
        }
    }
});

const endTimePicker = flatpickr("#end_time", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    minDate: "today",
    time_24hr: true,
    minuteIncrement: 1,
    defaultHour: new Date().getHours() + 1,
    defaultMinute: 0,
    utc: true,
    onReady: function(selectedDates, dateStr, instance) {
        instance.element.placeholder = "Select end time (hh:mm)";
    }
});

// Quick select buttons for time
document.querySelectorAll('.quick-select-btn').forEach(button => {
    button.addEventListener('click', function() {
        const minutes = parseInt(this.getAttribute('data-minutes'));
        const isStartTime = this.closest('.col-md-6').querySelector('label').textContent.includes('Start');
        const inputId = isStartTime ? 'start_time' : 'end_time';
        const fp = isStartTime ? startTimePicker : endTimePicker;
        
        if (isStartTime) {
            const newDate = new Date(Date.now() + minutes * 60 * 1000);
            fp.setDate(newDate);
            // Update end time minimum date
            endTimePicker.set('minDate', fp.selectedDates[0]);
        } else {
            let baseDate;
            if (startTimePicker.selectedDates.length > 0) {
                baseDate = startTimePicker.selectedDates[0];
            } else {
                // If no start time selected, set both start and end times
                baseDate = new Date();
                startTimePicker.setDate(baseDate);
                baseDate = startTimePicker.selectedDates[0];
            }
            const newDate = new Date(baseDate.getTime() + minutes * 60 * 1000);
            fp.setDate(newDate);
        }
    });
});

bookReservationBtn.addEventListener('click', async function() {
    const startTime = document.getElementById('start_time').value;
    const endTime = document.getElementById('end_time').value;
    
    if (!startTime || !endTime) {
        showToast('Please select both start and end times');
        return;
    }
    
    const now = new Date();
    const selectedStart = new Date(startTime);
    
    if (selectedStart < now) {
        showToast('Cannot book in past time. Please select future time slots.');
        return;
    }
    
    if (new Date(endTime) <= selectedStart) {
        showToast('End time must be after start time');
        return;
    }
    
    deviceSelectionOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    try {
        // Load both available and booked devices
        await Promise.all([loadDevices(), loadBookedDevices()]);
    } catch (error) {
        console.error('Error loading devices:', error);
        showToast('Failed to load device data', 'error');
    }
});
                    // Single event listener for the confirm button
            document.getElementById('confirmDeviceSelectionBtn').addEventListener('click', async function() {
                if (!selectedDeviceId) {
                    showToast('Please select a device first', 'warning');
                    return;
                }
                
                // Verify the selected device is still available
                const selectedDevice = allDevicesData.find(d => d.device_id === selectedDeviceId);
                if (!selectedDevice || selectedDevice.status !== 'available') {
                    showToast('The selected device is no longer available. Please select another device.', 'error');
                    return;
                }
                
                const csrfToken = document.querySelector('input[name="csrf_token"]').value;
                const loadingToast = showToast('Processing your reservation...', 'info', true);
                
                try {
                    const response = await fetch('/api/reservations', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken
                        },
                        body: JSON.stringify({
                            device_id: selectedDeviceId,
                            start_time: startTime,
                            end_time: endTime,
                            csrf_token: csrfToken
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok || !data.success) {
                        throw new Error(data.message || 'Failed to create reservation');
                    }
                    
                    showToast('Device booked successfully!', 'success');
                    deviceSelectionOverlay.style.display = 'none';
                    document.body.style.overflow = 'auto';
                    
                    // Refresh the reservations table
                    window.location.reload();
                    
                } catch (error) {
                    console.error('Booking error:', error);
                    showToast(error.message, 'error');
                } finally {
                    if (loadingToast) {
                        setTimeout(() => loadingToast.hide(), 2500);
                    }
                }
            });

            // Initialize with confirm button disabled
            document.getElementById('confirmDeviceSelectionBtn').disabled = true; 



    // Close overlay buttons
    closeOverlayBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            deviceSelectionOverlay.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    });

        deviceTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');
                
                deviceTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                if (tabName === 'available') {
                    availableDevicesTab.style.display = 'block';
                    bookedDevicesTab.style.display = 'none';
                    document.getElementById('confirmDeviceSelectionBtn').style.display = 'block';
                } else {
                    availableDevicesTab.style.display = 'none';
                    bookedDevicesTab.style.display = 'block';
                    document.getElementById('confirmDeviceSelectionBtn').style.display = 'none';
                }
            });
        });

        async function loadDevices() {
            const serverRackContainer = document.querySelector('.server-rack-container');
            serverRackContainer.innerHTML = '<div class="loading-message"><i class="fas fa-spinner fa-spin"></i> Loading devices...</div>';
            
            try {
                // Get the selected time range
                startTime = document.getElementById('start_time').value;
                endTime = document.getElementById('end_time').value;
                
                if (!startTime || !endTime) {
                    throw new Error('Please select both start and end times');
                }
                
                // Fetch devices with availability status
                const response = await fetch(`/api/devices/availability?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Validate response structure
                if (!data || !data.devices) {
                    throw new Error('Invalid response format from server');
                }
                
                allDevicesData = data.devices;
                renderDevices(allDevicesData);
                
            } catch (error) {
                console.error('Error loading devices:', error);
                serverRackContainer.innerHTML = `
                    <div class="error-message">
                        Error loading devices: ${error.message}
                        <button class="btn btn-sm btn-primary mt-2" onclick="loadDevices()">
                            <i class="fas fa-sync-alt me-1"></i> Retry
                        </button>
                    </div>
                `;
            }
        }

function updateDeviceDisplay() {
    const serverRackContainer = document.querySelector('.server-rack-container');
    
    if (!allDevicesData || allDevicesData.length === 0) {
        serverRackContainer.innerHTML = '<div class="no-devices">No devices found for the selected time period</div>';
        return;
    }
    
    let html = '<div class="device-grid">';
    
    allDevicesData.forEach(device => {
        const isBooked = device.status === 'booked';
        const bookingInfo = isBooked ? 
            `<div class="booking-info">
                Booked from ${new Date(device.reservation_start).toLocaleString()} 
                to ${new Date(device.reservation_end).toLocaleString()}
            </div>` : '';
            
        html += `
        <div class="device-card ${isBooked ? 'booked' : 'available'}">
            <div class="device-id">${device.device_id}</div>
            <div class="device-status">${isBooked ? 'Booked' : 'Available'}</div>
            ${bookingInfo}
            <div class="device-actions">
                <button class="btn btn-sm ${isBooked ? 'btn-secondary disabled' : 'btn-primary'}" 
                    ${isBooked ? 'disabled' : ''}
                    onclick="bookDevice('${device.device_id}')">
                    ${isBooked ? 'Already Booked' : 'Book Now'}
                </button>
            </div>
        </div>
        `;
    });
    
    html += '</div>';
    serverRackContainer.innerHTML = html;
}

            // Call this when time selection changes
            function onTimeRangeChange() {
                loadDevices();
            }

        function groupDevices(devices) {
            const groups = {};
            
            devices.forEach(device => {
                // Determine group (with better default handling)
                const groupKey = device.type?.trim() || 'Other Devices';
                if (!groups[groupKey]) {
                    groups[groupKey] = [];
                }
                groups[groupKey].push(device);
            });
            
            return groups;
        }

        // Example isTimeOverlap implementation
        function isTimeOverlap(start1, end1, start2, end2) {
            const startDate1 = new Date(start1);
            const endDate1 = new Date(end1);
            const startDate2 = new Date(start2);
            const endDate2 = new Date(end2);
            
            return startDate1 < endDate2 && endDate1 > startDate2;
        }

    document.getElementById('deviceFilter').addEventListener('input', function(e) {
        currentFilter = e.target.value.toLowerCase();
        filterDevices();
    });

    document.getElementById('clearFilter').addEventListener('click', function() {
        document.getElementById('deviceFilter').value = '';
        currentFilter = '';
        filterDevices();
    });

    function filterDevices() {
        if (!allDevicesData || allDevicesData.length === 0) return;

        let filteredDevices = allDevicesData.filter(device => {
            return device.device_id.toLowerCase().includes(currentFilter);
        });

        renderDevices(filteredDevices);
    }

        async function loadBookedDevices() {
            try {
                const response = await fetch('/api/booked-devices');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                console.log('response',response)
                const result = await response.json();
                console.log('result',result)
                // Validate response structure
                if (!result || !result.data || !result.data.booked_devices) {
                    throw new Error('Invalid response structure - missing booked_devices');
                }
                
                const data = result.data;
                console.log('Loaded booked devices:', data);
                // Ensure booked_devices is an array
                if (!Array.isArray(data.booked_devices)) {
                    throw new Error('booked_devices is not an array');
                }
                
                bookedDevicesData = data.booked_devices;
                console.log('Booked devices data:', bookedDevicesData);
                // Create device reservation map with proper checks
                const deviceReservationMap = {};
                
                data.booked_devices.forEach(booking => {
                    if (!booking.device || !booking.device.id || !booking.id) {
                        console.warn('Invalid booking record:', booking);
                        return; // Skip invalid records
                    }
                    
                    const deviceId = booking.device.id;
                    const reservationId = booking.id;
                    
                    if (!deviceReservationMap[deviceId]) {
                        deviceReservationMap[deviceId] = {};
                    }
                    
                    if (!deviceReservationMap[deviceId][reservationId]) {
                        deviceReservationMap[deviceId][reservationId] = {
                            ...booking,
                            drivers: [
                                { ip_type: 'CT1', ip_address: booking.device.ct1_ip || 'N/A' },
                                { ip_type: 'PC', ip_address: booking.device.pc_ip || 'N/A' },
                                { ip_type: 'Pulse1', ip_address: booking.device.pulse1_ip || 'N/A' },
                                { ip_type: 'Rutomatrix', ip_address: booking.device.rutomatrix_ip || 'N/A' }
                            ]
                        };
                    }
                });
                console.log('deviceReservationMap', typeof deviceReservationMap)
                renderBookedDevices(deviceReservationMap);
                return true;
            } catch (error) {
                console.error('Error loading booked devices:', error);
                showToast(`Failed to load booked devices: ${error.message}`, 'error');
                return false;
            }
        }

            function renderBookedDevices(deviceReservationMap) {
            const bookedDevicesCards = document.getElementById('bookedDevicesCards');
            bookedDevicesCards.innerHTML = '';
            
            // Check if we have any booked devices
            if (Object.keys(deviceReservationMap).length === 0) {
                bookedDevicesCards.innerHTML = `
                    <div class="text-center py-4 text-muted">
                        <i class="far fa-calendar-times fa-2x mb-2"></i><br>
                        No booked devices found
                    </div>
                `;
                return;
            }
            
            for (const deviceId in deviceReservationMap) {
                console.log('device is',deviceId)
                for (const reservationId in deviceReservationMap[deviceId]) {
                    console.log('reservationId', reservationId)
                    const reservation = deviceReservationMap[deviceId][reservationId];
                    const now = new Date();
                    const startTime = new Date(reservation.time.start);
                    const endTime = new Date(reservation.time.end);
                    
                    const status = endTime < now ? 'Expired' :
                                startTime <= now && now <= endTime ? 'Active' : 'Upcoming';
                    
                    const statusClass = endTime < now ? 'bg-secondary' :
                                    startTime <= now && now <= endTime ? 'bg-success' : 'bg-primary';
                    
                    // Default to a generic device icon if not specified
                    const iconClass = 'fas fa-desktop'; // Default icon
                    
                    const card = document.createElement('div');
                    card.className = 'booked-device-card';
                    card.innerHTML = `
                    <div class="booked-device-card-header">
                        <div class="d-flex align-items-center">
                            <i class="${iconClass} me-2"></i>
                            <h5 class="booked-device-card-title mb-0">Device ${reservation.device.id}</h5>
                        </div>
                        <span class="badge ${statusClass} booked-device-card-status">${status}</span>
                    </div>
                    <div class="booked-device-card-body">
                        <div class="booked-device-card-row">
                            <span class="booked-device-card-label">Device ID:</span>
                            <span class="booked-device-card-value">${reservation.device.id}</span>
                        </div>
                        <div class="booked-device-card-row">
                            <span class="booked-device-card-label">User ID:</span>
                            <span class="booked-device-card-value">${reservation.user.id || 'N/A'}</span>
                        </div>
                        <div class="booked-device-card-row">
                            <span class="booked-device-card-label">Start:</span>
                            <span class="booked-device-card-value">${formatDateTime(reservation.time.start)}</span>
                        </div>
                        <div class="booked-device-card-row">
                            <span class="booked-device-card-label">End:</span>
                            <span class="booked-device-card-value">${formatDateTime(reservation.time.end)}</span>
                        </div>
                        <div class="booked-device-card-row">
                            <span class="booked-device-card-label">Duration:</span>
                            <span class="booked-device-card-value">${reservation.time.duration_minutes} minutes</span>
                        </div>
                    </div>
                    <!-- JavaScript version (unchanged) -->
                    <!-- JavaScript version (unchanged) -->
                    <div class="booked-device-card-footer">
                        ${reservation.user.role === 'admin' ? `
                        <button class="btn btn-sm btn-outline-danger cancel-btn"
                            title="Cancel Reservation"
                            data-reservation-id="${reservation.id}">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                        ` : ''}
                    </div>
                    `;
                    
                    bookedDevicesCards.appendChild(card);
                }
            }
            
            addBookingButtonEventListeners();
        }

    function getDeviceIconClass(deviceType) {
        const type = deviceType.toLowerCase();
        if (type.includes('rutomatrix')) return 'fas fa-microchip rutomatrix-icon';
        if (type.includes('pulse')) return 'pulse-icon';
        if (type.includes('ct')) return 'fas fa-camera ct-icon';
        if (type.includes('pc')) return 'fas fa-desktop pc-icon';
        return 'fas fa-server other-icon';
    }

        async function cancelReservation(reservationId) {
            if (!confirm('Are you sure you want to cancel this reservation?')) return;

            // Find all buttons for this reservation
            const buttons = document.querySelectorAll(`.cancel-btn[data-reservation-id="${reservationId}"], 
                                                    [data-reservation-id="${reservationId}"] .cancel-btn`);
            
            // Set loading state
            buttons.forEach(btn => {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';
            });

            try {
                const csrfToken = document.querySelector('input[name="csrf_token"]').value;
                const response = await fetch(`/reservation/cancel/${reservationId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({ csrf_token: csrfToken })
                });

                if (!response.ok) throw new Error('Failed to cancel reservation');

                // Find and remove the table row
                const row = document.querySelector(`tr.reservation-row[data-reservation-id="${reservationId}"]`);
                if (row) {
                    row.style.transition = 'opacity 0.3s ease';
                    row.style.opacity = '0';
                    setTimeout(() => {
                        row.remove();
                        updateReservationCount(); // Update counter if needed
                    }, 300);
                }

                showToast('Reservation cancelled successfully!', 'success');
                window.location.reload()
            } catch (error) {
                console.error('Cancellation error:', error);
                showToast(error.message, 'error');
                buttons.forEach(btn => {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-times"></i> Cancel';
                });
            }
        }

        // Event delegation for all cancel buttons
        document.addEventListener('click', function(e) {
            const btn = e.target.closest('.cancel-btn');
            if (!btn) return;
            
            e.preventDefault();
            const form = btn.closest('form');
            const row = btn.closest('tr');
            const reservationId = btn.dataset.reservationId || 
                                form?.dataset.reservationId || 
                                row?.dataset.reservationId;
            
            if (reservationId) cancelReservation(reservationId);
        });



// Toast notification function
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
    
    // Manual close
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    });
}


    function getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    }

    function formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function addBookingButtonEventListeners() {
        document.querySelectorAll('.launch-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const deviceId = this.getAttribute('data-device-id');
                const ipType = this.getAttribute('data-ip-type');
                const reservationId = this.getAttribute('data-reservation-id');
                launchDashboard(deviceId, ipType, reservationId);
            });
        });
    }



        function selectDevice(device) {
            // Remove selection from all other cards first
            document.querySelectorAll('.device-card').forEach(card => {
                card.classList.remove('selected');
            });
            // Highlight the newly selected device with orange border
            const deviceElement = document.querySelector(`.device-card[data-device-id="${device.device_id}"]`);
            if (deviceElement) {
                deviceElement.classList.add('selected');
            }
            // Store the selected device ID
            selectedDeviceId = device.device_id;
            // Enable the confirm button since we have a selection
            document.getElementById('confirmDeviceSelectionBtn').disabled = false;
        }




        function createDeviceCard(device) {
            const deviceCard = document.createElement('div');
            deviceCard.className = 'device-card';
            deviceCard.dataset.deviceId = device.device_id;
            
            if (device.status === 'booked') {
                deviceCard.classList.add('booked', 'disabled');
            } else {
                deviceCard.classList.add('available');
            }

            const deviceName = device.name || `Device ${device.device_id}`;
            const iconClass = getDeviceIconClass(device.type || 'other');
            
            deviceCard.innerHTML = `
                <div class="device-icon">
                    <i class="${iconClass}"></i>
                </div>
                <div class="device-name">${deviceName}</div>
                <div class="device-status">
                    ${device.status === 'available' ? 
                        `<span class="badge bg-success">Available</span>` : 
                        `<span class="badge bg-danger">Booked</span>`
                    }
                </div>
            `;

            if (device.status === 'available') {
                deviceCard.addEventListener('click', () => {
                    // Remove selection from all other cards
                    document.querySelectorAll('.device-card').forEach(card => {
                        card.classList.remove('selected');
                    });
                    
                    // Select this card
                    deviceCard.classList.add('selected');
                    selectedDeviceId = device.device_id;
                    showToast(`Device ${device.device_id} selected. Click "Confirm" to book.`, 'info');
                });
            } else {
                deviceCard.addEventListener('click', () => {
                    showToast('This device is already booked for the selected time', 'warning');
                });
            }

            return deviceCard;
        }



        function updateDeviceCardStatus(deviceId) {
            const deviceCards = document.querySelectorAll('.device-card');
            const device = allDevicesData.find(d => d.device_id === deviceId);
            
            if (!device) return;

            const deviceBookings = bookedDevicesData.filter(booking => 
                booking.device_id === deviceId
            );
            
            const isBooked = deviceBookings.some(booking => 
                isTimeOverlap(startTime, endTime, booking.start_time, booking.end_time)
            );
            
            const newStatus = isBooked ? 'booked' : 'available';

            deviceCards.forEach(card => {
                if (card.dataset.deviceId === deviceId) {
                    card.classList.remove('available', 'booked', 'disabled');
                    
                    if (isBooked) {
                        card.classList.add('booked', 'disabled');
                        card.querySelector('.device-status').innerHTML = '<span class="badge bg-danger">Booked</span>';
                        
                        card.onclick = () => {
                            showToast('This device is already booked for the selected time', 'warning');
                        };
                    } else {
                        card.classList.add('available');
                        card.querySelector('.device-status').innerHTML = '<span class="badge bg-success">Available</span>';
                        
                        card.onclick = () => {
                            // Remove selection from all other cards
                            document.querySelectorAll('.device-card').forEach(c => {
                                c.classList.remove('selected');
                            });
                            
                            // Select this card
                            card.classList.add('selected');
                            selectedDeviceId = device.device_id;
                            showToast(`Device ${device.device_id} selected. Click "Confirm" to book.`, 'info');
                        };
                    }

                    const deviceIndex = allDevicesData.findIndex(d => d.device_id === deviceId);
                    if (deviceIndex !== -1) {
                        allDevicesData[deviceIndex].status = newStatus;
                    }
                }
            });
        }

    function renderDevices(devices) {
        const serverRackContainer = document.querySelector('.server-rack-container');
        serverRackContainer.innerHTML = '';

        const grouped = groupDevices(devices);
        const devicesPerPage = 10;

        for (const [group, groupDevices] of Object.entries(grouped)) {
            const groupSection = document.createElement('div');
            groupSection.classList.add('device-group');
 
            const groupTitle = document.createElement('h5');
            groupTitle.textContent = group;
            groupSection.appendChild(groupTitle);
 
            const paginationContainer = document.createElement('div');
            paginationContainer.classList.add('pagination-container');

            const deviceGrid = document.createElement('div');
            deviceGrid.classList.add('device-grid');

            showPage(groupDevices, deviceGrid, 1, devicesPerPage);

            if (groupDevices.length > devicesPerPage) {
                const pageCount = Math.ceil(groupDevices.length / devicesPerPage);
                const pagination = createPaginationControls(pageCount, groupDevices, deviceGrid, devicesPerPage);
                paginationContainer.appendChild(pagination);
            }

            groupSection.appendChild(paginationContainer);
            groupSection.appendChild(deviceGrid);
            serverRackContainer.appendChild(groupSection);
        }
    }
 
    function showPage(devices, container, pageNumber, perPage) {
        container.innerHTML = '';

        const startIndex = (pageNumber - 1) * perPage;
        const endIndex = Math.min(startIndex + perPage, devices.length);

        for (let i = startIndex; i < endIndex; i++) {
            const deviceCard = createDeviceCard(devices[i]);
            container.appendChild(deviceCard);
        }
    }
 
    function createPaginationControls(pageCount, devices, deviceGrid, perPage) {
        const pagination = document.createElement('ul');
        pagination.classList.add('pagination');

        const prevItem = document.createElement('li');
        prevItem.classList.add('page-item');
        prevItem.innerHTML = '<a class="page-link" href="#">&laquo;</a>';
        prevItem.addEventListener('click', (e) => {
            e.preventDefault();
            const activePage = pagination.querySelector('.page-item.active');
            const currentPage = parseInt(activePage.textContent);
            if (currentPage > 1) {
                updateActivePage(pagination, currentPage - 1);
                showPage(devices, deviceGrid, currentPage - 1, perPage);
            }
        });
        pagination.appendChild(prevItem);

        for (let i = 1; i <= pageCount; i++) {
            const pageItem = document.createElement('li');
            pageItem.classList.add('page-item');
            if (i === 1) pageItem.classList.add('active');
            pageItem.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            pageItem.addEventListener('click', (e) => {
                e.preventDefault();
                updateActivePage(pagination, i);
                showPage(devices, deviceGrid, i, perPage);
            });
            pagination.appendChild(pageItem);
        }

        const nextItem = document.createElement('li');
        nextItem.classList.add('page-item');
        nextItem.innerHTML = '<a class="page-link" href="#">&raquo;</a>';
        nextItem.addEventListener('click', (e) => {
            e.preventDefault();
            const activePage = pagination.querySelector('.page-item.active');
            const currentPage = parseInt(activePage.textContent);
            if (currentPage < pageCount) {
                updateActivePage(pagination, currentPage + 1);
                showPage(devices, deviceGrid, currentPage + 1, perPage);
            }
        });
        pagination.appendChild(nextItem);

        return pagination;
    }
 
    function updateActivePage(pagination, newActivePage) {
        const pages = pagination.querySelectorAll('.page-item');
        pages.forEach(page => {
            page.classList.remove('active');
            if (page.textContent === String(newActivePage)) {
                page.classList.add('active');
            }
        });
    }

    function createDeviceCard(device) {
        const deviceCard = document.createElement('div');
        deviceCard.className = 'device-card';
        deviceCard.dataset.deviceId = device.device_id;
        
        if (device.status === 'booked') {
            deviceCard.classList.add('booked');
            deviceCard.classList.add('disabled');
        } else {
            deviceCard.classList.add('available');
        }

        const deviceName = device.name || `Device ${device.device_id}`;
        const iconClass = getDeviceIconClass(device.type || 'other');
        
        deviceCard.innerHTML = `
            <div class="device-icon">
                <i class="${iconClass}"></i>
            </div>
            <div class="device-name">${deviceName}</div>
            <div class="device-status">
                ${device.status === 'available' ? 
                    `<span class="badge bg-success">Available</span>` : 
                    `<span class="badge bg-danger">Booked</span>`
                }
            </div>
        `;

        if (device.status === 'available') {
            deviceCard.addEventListener('click', () => selectDevice(device));
        } else {
            deviceCard.addEventListener('click', () => {
                showToast('This device is already booked for the selected time', 'warning');
            });
        }

        return deviceCard;
    }

    function isTimeOverlap(start1, end1, start2, end2) {
        const startDate1 = new Date(start1);
        const endDate1 = new Date(end1);
        const startDate2 = new Date(start2);
        const endDate2 = new Date(end2);
        
        return startDate1 < endDate2 && endDate1 > startDate2;
    }
   
    function formatDateTime(dateTimeStr) {
        const date = new Date(dateTimeStr);
        return date.toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatTime(dateTimeStr) {
        const date = new Date(dateTimeStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

        function showToast(message, type = 'info') {
            // Create toast element
            const toast = document.createElement('div');
            toast.className = `toast show align-items-center text-white bg-${type}`;
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px';
            toast.style.zIndex = '10000';
            
            toast.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            `;
            
            document.body.appendChild(toast);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                toast.remove();
            }, 5000);
            
            // Add click to dismiss
            toast.querySelector('.btn-close').addEventListener('click', () => {
                toast.remove();
            });
        }

    document.getElementById('bookedDeviceFilter').addEventListener('input', function () {
        const filterValue = this.value.toLowerCase();
        filterBookedDevicesById(filterValue);
    });

    document.getElementById('clearBookedFilter').addEventListener('click', function () {
        document.getElementById('bookedDeviceFilter').value = '';
        filterBookedDevicesById('');
    });

    function filterBookedDevicesById(filterValue) {
        const cards = document.querySelectorAll('#bookedDevicesCards .booked-device-card');
        cards.forEach(card => {
            const deviceId = card.querySelector('.booked-device-card-row .booked-device-card-value')?.textContent?.toLowerCase() || '';
            card.style.display = deviceId.includes(filterValue) ? '' : 'none';
        });
    }

    // Auto-refresh functionality
    function setupAutoRefresh() {
        const now = new Date();
        const nowTimestamp = now.getTime() / 1000;
        let refreshTimeouts = [];

        refreshTimeouts.forEach(timeout => clearTimeout(timeout));
        refreshTimeouts = [];

        document.querySelectorAll('tr[data-start-time][data-end-time]').forEach(row => {
            const startTime = parseFloat(row.getAttribute('data-start-time'));
            const endTime = parseFloat(row.getAttribute('data-end-time'));
            const status = row.getAttribute('data-status');

            let timeUntilRefresh;

            if (status === 'upcoming') {
                timeUntilRefresh = startTime - nowTimestamp;
            } else if (status === 'active') {
                timeUntilRefresh = endTime - nowTimestamp;
            } else {
                return;
            }

            if (timeUntilRefresh > 0) {
                const timeoutId = setTimeout(() => {
                    window.location.reload();
                }, timeUntilRefresh * 1000);

                refreshTimeouts.push(timeoutId);
            }
        });
    }

    // Initialize auto-refresh
    setupAutoRefresh();

    // Table Sorting Functionality
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', function() {
            const table = this.closest('table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const sortKey = this.getAttribute('data-sort');
            const isAscending = !this.classList.contains('sorted-asc');
            
            table.querySelectorAll('.sortable').forEach(h => {
                h.classList.remove('sorted-asc', 'sorted-desc');
            });
            
            this.classList.add(isAscending ? 'sorted-asc' : 'sorted-desc');
            
            rows.sort((a, b) => {
                const aValue = a.getAttribute(`data-${sortKey}`) || a.cells[Array.from(this.parentNode.children).indexOf(this)].textContent;
                const bValue = b.getAttribute(`data-${sortKey}`) || b.cells[Array.from(this.parentNode.children).indexOf(this)].textContent;
                
                if (sortKey === 'startTime' || sortKey === 'endTime') {
                    return isAscending 
                        ? parseFloat(aValue) - parseFloat(bValue)
                        : parseFloat(bValue) - parseFloat(aValue);
                } else {
                    return isAscending 
                        ? aValue.localeCompare(bValue)
                        : bValue.localeCompare(aValue);
                }
            });
            
            rows.forEach(row => tbody.appendChild(row));
            updatePaginationDisplay();
        });
    });

    // Pagination and Entries Per Page
    let currentPage = 1;
    let entriesPerPage = 10;

    document.getElementById('entriesPerPage').addEventListener('change', function() {
        entriesPerPage = parseInt(this.value);
        currentPage = 1;
        updateTableDisplay();
    });

    function updateTableDisplay() {
        const rows = document.querySelectorAll('#reservationsBody tr');
        const startIndex = (currentPage - 1) * entriesPerPage;
        const endIndex = startIndex + entriesPerPage;
        
        rows.forEach((row, index) => {
            row.style.display = (index >= startIndex && index < endIndex) ? '' : 'none';
        });
        
        updatePaginationDisplay();
        setupAutoRefresh(); // Refresh timers when table updates
    }

    function updatePaginationDisplay() {
        const totalRows = document.querySelectorAll('#reservationsBody tr').length;
        const totalPages = Math.ceil(totalRows / entriesPerPage);
        const pagination = document.querySelector('.pagination');
        
        const startRow = (currentPage - 1) * entriesPerPage + 1;
        const endRow = Math.min(currentPage * entriesPerPage, totalRows);
        document.getElementById('showingFrom').textContent = startRow;
        document.getElementById('showingTo').textContent = endRow;
        document.getElementById('totalEntries').textContent = totalRows;
        
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        
        prevPage.classList.toggle('disabled', currentPage === 1);
        nextPage.classList.toggle('disabled', currentPage === totalPages);
        
        const pageItems = pagination.querySelectorAll('.page-item:not(#prevPage):not(#nextPage)');
        pageItems.forEach(item => item.remove());
        
        for (let i = 1; i <= totalPages; i++) {
            const pageItem = document.createElement('li');
            pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
            pageItem.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            pageItem.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = i;
                updateTableDisplay();
            });
            nextPage.before(pageItem);
        }
    }

    // Search Functionality
    document.getElementById('reservationSearch').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const rows = document.querySelectorAll('#reservationsBody tr');
        
        rows.forEach(row => {
            const rowText = Array.from(row.cells)
                .map(cell => cell.textContent.toLowerCase())
                .join(' ');
            row.style.display = rowText.includes(searchTerm) ? '' : 'none';
        });
        
        currentPage = 1;
        updatePaginationDisplay();
    });

    // Initialize table display
    updateTableDisplay();

    // Pagination button event handlers
    document.getElementById('prevPage').addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            updateTableDisplay();
        }
    });

    document.getElementById('nextPage').addEventListener('click', function(e) {
        e.preventDefault();
        const totalRows = document.querySelectorAll('#reservationsBody tr').length;
        const totalPages = Math.ceil(totalRows / entriesPerPage);
        
        if (currentPage < totalPages) {
            currentPage++;
            updateTableDisplay();
        }
    });

    document.querySelectorAll('.launch-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const deviceId = this.getAttribute('data-device-id');
            const ipType = this.getAttribute('data-ip-type');
            const reservationId = this.getAttribute('data-reservation-id');
           
            launchDashboard(deviceId, ipType, reservationId);
        });
    });

    function launchDashboard(deviceId, ipType, reservationId) {
        const baseUrl = 'http://localhost:3000/dashboard';
        const params = new URLSearchParams({
            device: deviceId,
            ip_type: ipType,
            reservation: reservationId
        });
       
        const fullUrl = `${baseUrl}?${params.toString()}`;
       
        console.log(`Navigating to: ${fullUrl}`);
       
        window.location.href = fullUrl;
    }
});
   