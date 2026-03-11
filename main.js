const fs = require("fs");

function getShiftDuration(startTime, endTime) {

    function toSeconds(time) {
        time = time.trim().toLowerCase();
        let [clock, period] = time.split(" ");
        let [h, m, s] = clock.split(":").map(Number);

        if (period === "pm" && h !== 12) h += 12;
        if (period === "am" && h === 12) h = 0;

        return h * 3600 + m * 60 + s;
    }

    let start = toSeconds(startTime);
    let end = toSeconds(endTime);

    let diff = end - start;

    // FIX for overnight shift
    if (diff < 0) diff += 24 * 3600;

    let h = Math.floor(diff / 3600);
    let m = Math.floor((diff % 3600) / 60);
    let s = diff % 60;

    m = String(m).padStart(2, "0");
    s = String(s).padStart(2, "0");

    return `${h}:${m}:${s}`;
}


// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
 

    function toSeconds(time) {
        time = time.trim().toLowerCase();
        let [clock, period] = time.split(" ");
        let [h, m, s] = clock.split(":").map(Number);

        if (period === "pm" && h !== 12) h += 12;
        if (period === "am" && h === 12) h = 0;

        return h * 3600 + m * 60 + s;
    }

    let start = toSeconds(startTime);
    let end = toSeconds(endTime);

    const startDelivery = 8 * 3600;      // 8:00 AM
    const endDelivery = 22 * 3600;       // 10:00 PM

    let idle = 0;

    if (start < startDelivery) {
        idle += startDelivery - start;
    }

    if (end > endDelivery) {
        idle += end - endDelivery;
    }

    let h = Math.floor(idle / 3600);
    let m = Math.floor((idle % 3600) / 60);
    let s = idle % 60;

    m = String(m).padStart(2, "0");
    s = String(s).padStart(2, "0");

    return `${h}:${m}:${s}`;

}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {

    function toSeconds(time) {
        let [h, m, s] = time.split(":").map(Number);
        return h * 3600 + m * 60 + s;
    }

    let shiftSec = toSeconds(shiftDuration);
    let idleSec = toSeconds(idleTime);

    let activeSec = shiftSec - idleSec;

    let h = Math.floor(activeSec / 3600);
    let m = Math.floor((activeSec % 3600) / 60);
    let s = activeSec % 60;

    m = String(m).padStart(2, "0");
    s = String(s).padStart(2, "0");

    return `${h}:${m}:${s}`;
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {

    function timeToSeconds(time) {
        let parts = time.split(":").map(Number);
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    let activeSeconds = timeToSeconds(activeTime);

    let quotaSeconds;

    if (date >= "2025-04-10" && date <= "2025-04-30") {
        quotaSeconds = timeToSeconds("6:00:00");
    } else {
        quotaSeconds = timeToSeconds("8:24:00");
    }

    return activeSeconds >= quotaSeconds;
}
// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {

    let content = fs.readFileSync(textFile, "utf8");
    let lines = content.trim().split("\n");

    // 1️⃣ Check for duplicate (same driverID + date)
    for (let line of lines) {

        let parts = line.split(",");

        let driverID = parts[0];
        let date = parts[2];

        if (driverID === shiftObj.driverID && date === shiftObj.date) {
            return {};
        }
    }

    // 2️⃣ Calculate values
    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let met = metQuota(shiftObj.date, activeTime);

    let newObj = {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: met,
        hasBonus: false
    };

    // 3️⃣ Create new line for file
    let newLine = [
        newObj.driverID,
        newObj.driverName,
        newObj.date,
        newObj.startTime,
        newObj.endTime,
        newObj.shiftDuration,
        newObj.idleTime,
        newObj.activeTime,
        newObj.metQuota,
        newObj.hasBonus
    ].join(",");

    // 4️⃣ Find last record of this driverID
    let index = -1;

    for (let i = 0; i < lines.length; i++) {
        let parts = lines[i].split(",");
        if (parts[0] === shiftObj.driverID) {
            index = i;
        }
    }

    // 5️⃣ Insert correctly
    if (index === -1) {
        lines.push(newLine);
    } else {
        lines.splice(index + 1, 0, newLine);
    }

    // 6️⃣ Write back to file
    fs.writeFileSync(textFile, lines.join("\n"));

    return newObj;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================


function setBonus(textFile, driverID, date, newValue){

    let data = fs.readFileSync(textFile,"utf8");
    let lines = data.trim().split("\n");

    for(let i=1;i<lines.length;i++){

        let row = lines[i].split(",");

        if(row[0] === driverID && row[2] === date){

            row[9] = newValue;
            lines[i] = row.join(",");
            break;

        }
    }

    fs.writeFileSync(textFile,lines.join("\n"));
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    // TODO: Implement this function
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
