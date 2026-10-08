package com.networkqosmonitor.telephony

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.CellIdentityGsm
import android.telephony.CellIdentityLte
import android.telephony.CellIdentityNr
import android.telephony.CellIdentityWcdma
import android.telephony.CellInfo
import android.telephony.CellInfoGsm
import android.telephony.CellInfoLte
import android.telephony.CellInfoNr
import android.telephony.CellInfoWcdma
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TelephonyModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TelephonyModule"

    @ReactMethod
    fun getCellularDetails(promise: Promise) {
        try {
            val telephonyManager = reactContext.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
            if (telephonyManager == null) {
                promise.reject("UNAVAILABLE", "TelephonyManager no está disponible en este dispositivo")
                return
            }

            val result = Arguments.createMap()

            // 1. Permisos en tiempo de ejecución
            val hasLocationPermission = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            val hasPhoneStatePermission = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.READ_PHONE_STATE
            ) == PackageManager.PERMISSION_GRANTED

            result.putBoolean("hasLocationPermission", hasLocationPermission)
            result.putBoolean("hasPhoneStatePermission", hasPhoneStatePermission)

            // 2. Información básica del operador (con captura de excepciones defensiva)
            val simOperator = try {
                telephonyManager.simOperatorName.orEmpty().ifEmpty { "Desconocido" }
            } catch (_: Exception) {
                "Desconocido"
            }

            val networkOperator = try {
                telephonyManager.networkOperatorName.orEmpty().ifEmpty { simOperator }
            } catch (_: Exception) {
                simOperator
            }

            val isRoaming = try {
                telephonyManager.isNetworkRoaming
            } catch (_: Exception) {
                false
            }

            result.putString("operatorName", networkOperator)
            result.putString("simOperatorName", simOperator)
            result.putBoolean("isRoaming", isRoaming)

            // 3. Tipo de red celular (LTE, 5G, 3G, etc.)
            val networkTypeStr = getNetworkTypeString(telephonyManager, hasPhoneStatePermission)
            result.putString("networkType", networkTypeStr)

            // 4. Intensidad de señal e información de celdas
            var signalDbm = -999
            var signalLevel = -1
            var asuLevel = -1
            var cellId: Long? = null
            var tac: Int? = null

            // Extraer nivel de señal global (API 29+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    val ss = telephonyManager.signalStrength
                    if (ss != null) {
                        signalLevel = ss.level
                        val cellStrengths = ss.cellSignalStrengths
                        if (cellStrengths.isNotEmpty()) {
                            val primary = cellStrengths.firstOrNull()
                            if (primary != null) {
                                signalDbm = primary.dbm
                                asuLevel = primary.asuLevel
                            }
                        }
                    }
                } catch (_: Exception) {
                    // Ignorar fallback a CellInfo
                }
            }

            // Si contamos con permiso de ubicación, consultar allCellInfo para obtener la celda registrada
            if (hasLocationPermission) {
                try {
                    val cellInfoList: List<CellInfo>? = telephonyManager.allCellInfo
                    if (!cellInfoList.isNullOrEmpty()) {
                        val registeredCell = cellInfoList.firstOrNull { it.isRegistered } ?: cellInfoList.firstOrNull()
                        if (registeredCell != null) {
                            when (registeredCell) {
                                is CellInfoLte -> {
                                    if (signalDbm == -999) signalDbm = registeredCell.cellSignalStrength.dbm
                                    if (signalLevel == -1) signalLevel = registeredCell.cellSignalStrength.level
                                    if (asuLevel == -1) asuLevel = registeredCell.cellSignalStrength.asuLevel
                                    val ci = registeredCell.cellIdentity.ci
                                    if (ci != Int.MAX_VALUE && ci != -1) cellId = ci.toLong()
                                    val t = registeredCell.cellIdentity.tac
                                    if (t != Int.MAX_VALUE && t != -1) tac = t
                                }
                                is CellInfoWcdma -> {
                                    if (signalDbm == -999) signalDbm = registeredCell.cellSignalStrength.dbm
                                    if (signalLevel == -1) signalLevel = registeredCell.cellSignalStrength.level
                                    if (asuLevel == -1) asuLevel = registeredCell.cellSignalStrength.asuLevel
                                    val cid = registeredCell.cellIdentity.cid
                                    if (cid != Int.MAX_VALUE && cid != -1) cellId = cid.toLong()
                                    val lac = registeredCell.cellIdentity.lac
                                    if (lac != Int.MAX_VALUE && lac != -1) tac = lac
                                }
                                is CellInfoGsm -> {
                                    if (signalDbm == -999) signalDbm = registeredCell.cellSignalStrength.dbm
                                    if (signalLevel == -1) signalLevel = registeredCell.cellSignalStrength.level
                                    if (asuLevel == -1) asuLevel = registeredCell.cellSignalStrength.asuLevel
                                    val cid = registeredCell.cellIdentity.cid
                                    if (cid != Int.MAX_VALUE && cid != -1) cellId = cid.toLong()
                                    val lac = registeredCell.cellIdentity.lac
                                    if (lac != Int.MAX_VALUE && lac != -1) tac = lac
                                }
                                else -> {
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && registeredCell is CellInfoNr) {
                                        if (signalDbm == -999) signalDbm = registeredCell.cellSignalStrength.dbm
                                        if (signalLevel == -1) signalLevel = registeredCell.cellSignalStrength.level
                                        if (asuLevel == -1) asuLevel = registeredCell.cellSignalStrength.asuLevel
                                        val idNr = registeredCell.cellIdentity as? CellIdentityNr
                                        idNr?.let {
                                            val nci = it.nci
                                            if (nci != Long.MAX_VALUE && nci != -1L) cellId = nci
                                            val t = it.tac
                                            if (t != Int.MAX_VALUE && t != -1) tac = t
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (_: Exception) {
                    // Manejo silencioso en caso de excepciones de permisos o de hardware
                }
            }

            result.putInt("signalDbm", signalDbm)
            result.putInt("signalLevel", signalLevel)
            result.putInt("asuLevel", asuLevel)

            if (cellId != null) {
                result.putDouble("cellId", cellId.toDouble())
            } else {
                result.putNull("cellId")
            }

            if (tac != null) {
                result.putInt("tac", tac)
            } else {
                result.putNull("tac")
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("TELEPHONY_ERROR", e.localizedMessage, e)
        }
    }

    @Suppress("DEPRECATION")
    private fun getNetworkTypeString(telephonyManager: TelephonyManager, hasPhonePermission: Boolean): String {
        if (!hasPhonePermission) {
            return "Permiso requerido (READ_PHONE_STATE)"
        }

        val type = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                telephonyManager.dataNetworkType
            } else {
                telephonyManager.networkType
            }
        } catch (_: SecurityException) {
            TelephonyManager.NETWORK_TYPE_UNKNOWN
        } catch (_: Exception) {
            TelephonyManager.NETWORK_TYPE_UNKNOWN
        }

        return when (type) {
            TelephonyManager.NETWORK_TYPE_NR -> "5G NR"
            TelephonyManager.NETWORK_TYPE_LTE -> "4G LTE"
            TelephonyManager.NETWORK_TYPE_HSPAP,
            TelephonyManager.NETWORK_TYPE_HSPA,
            TelephonyManager.NETWORK_TYPE_HSDPA,
            TelephonyManager.NETWORK_TYPE_HSUPA,
            TelephonyManager.NETWORK_TYPE_UMTS -> "3G (HSPA/UMTS)"
            TelephonyManager.NETWORK_TYPE_EDGE -> "2G EDGE"
            TelephonyManager.NETWORK_TYPE_GPRS -> "2G GPRS"
            TelephonyManager.NETWORK_TYPE_UNKNOWN -> "Desconocido / Sin datos"
            else -> "Celular (Tipo $type)"
        }
    }
}
