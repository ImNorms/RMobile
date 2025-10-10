// LoginScreen.js
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ✅ Firebase imports
import { auth } from './firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode
} from 'firebase/auth';

const { height: screenHeight } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Forgot Password Modal States
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: email, 2: code, 3: new password
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // ✅ Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // ✅ Dismiss keyboard when tapping outside
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // ✅ Login with Firebase
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Logged in:", userCredential.user.email);
      navigation.replace("Home", { userEmail: userCredential.user.email });
    } catch (error) {
      console.error("Login error:", error.code);
      let message = "Login failed. Please try again.";
      if (error.code === "auth/invalid-email") {
        message = "Invalid email format.";
      } else if (error.code === "auth/user-not-found") {
        message = "No account found with this email.";
      } else if (error.code === "auth/wrong-password") {
        message = "Incorrect password.";
      }
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Extract OOB code from Firebase URL - IMPROVED VERSION
  const extractOobCodeFromUrl = (url) => {
    try {
      console.log("Extracting code from URL:", url);
      
      // Remove any extra spaces or quotes
      const cleanUrl = url.trim().replace(/['"]/g, '');
      
      // Method 1: If it contains oobCode parameter, extract it (even without http)
      if (cleanUrl.includes('oobCode=')) {
        const oobCodeMatch = cleanUrl.match(/oobCode=([^&]+)/);
        if (oobCodeMatch && oobCodeMatch[1]) {
          const extractedCode = oobCodeMatch[1];
          console.log("Extracted OOB code via regex:", extractedCode);
          return extractedCode;
        }
      }
      
      // Method 2: Use URL constructor if it's a full URL
      if (cleanUrl.includes('http')) {
        try {
          const urlObj = new URL(cleanUrl);
          const oobCode = urlObj.searchParams.get('oobCode');
          console.log("Extracted OOB code from URL:", oobCode);
          return oobCode;
        } catch (urlError) {
          console.log("URL constructor failed, trying regex");
        }
      }
      
      // Method 3: If it's already just the code (no &, no =, no spaces)
      if (cleanUrl.length > 20 && !cleanUrl.includes('&') && !cleanUrl.includes('=') && !cleanUrl.includes(' ')) {
        console.log("Input appears to be raw OOB code");
        return cleanUrl;
      }
      
      console.log("Could not extract OOB code from input");
      return null;
    } catch (error) {
      console.error("Error extracting OOB code:", error);
      return null;
    }
  };

  // ✅ Clean and validate OOB code - IMPROVED VERSION
  const cleanOobCode = (code) => {
    if (!code) return null;
    
    console.log("Cleaning code:", code);
    
    // First, try to extract from any URL-like string
    const extracted = extractOobCodeFromUrl(code);
    if (extracted) {
      console.log("Cleaned via extraction:", extracted);
      return extracted;
    }
    
    // If extraction didn't work, clean the input directly
    let cleanCode = code.trim();
    
    // Remove any URL fragments or extra parameters
    cleanCode = cleanCode.split('&')[0]; // Remove everything after &
    cleanCode = cleanCode.split('?')[0]; // Remove everything after ?
    cleanCode = cleanCode.split(' ')[0]; // Remove everything after space
    
    console.log("Cleaned OOB code:", cleanCode);
    return cleanCode;
  };

  // ✅ Send Password Reset Email
  const handleSendResetEmail = async () => {
    if (!resetEmail) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      
      Alert.alert(
        "Check Your Email", 
        `We've sent a password reset email to ${resetEmail}. 
        
📧 **IMPORTANT - Please read carefully:**

**OPTION 1 - RECOMMENDED:**
1. Open the email on your phone
2. Long-press the reset link and copy the ENTIRE URL
3. Return to this app and paste the full link in the box below

**OPTION 2 - MANUAL:**
1. Copy ONLY the code part after "oobCode="
2. The code should look like: M3S3YuPmHUElrG3_N-sx_B9sc1PDMU2M2xtQcAAAGZzvZNrA

**Do NOT include &apiKey=... or &lang=en**`,
        [
          {
            text: "Open Email App",
            onPress: () => Linking.openURL('message://')
          },
          {
            text: "I Understand",
            onPress: () => setResetStep(2)
          }
        ]
      );
    } catch (error) {
      console.error("Reset email error:", error.code);
      let message = "Failed to send reset email. Please try again.";
      if (error.code === "auth/user-not-found") {
        message = "No account found with this email.";
      } else if (error.code === "auth/invalid-email") {
        message = "Invalid email format.";
      }
      Alert.alert("Error", message);
    } finally {
      setResetLoading(false);
    }
  };

  // ✅ Verify Reset Code - IMPROVED VERSION
  const handleVerifyCode = async () => {
    if (!resetCode) {
      Alert.alert("Error", "Please enter the reset code from your email");
      return;
    }

    setResetLoading(true);
    try {
      console.log("Original reset code input:", resetCode);
      
      // Extract and clean the OOB code
      let actualCode = extractOobCodeFromUrl(resetCode);
      
      if (!actualCode) {
        // If extraction failed, try cleaning the input directly
        actualCode = cleanOobCode(resetCode);
      }
      
      // Validate the code format
      if (!actualCode) {
        Alert.alert("Error", "Could not extract valid reset code. Please paste the entire reset link or just the code part.");
        return;
      }
      
      // Additional validation: OOB codes should be a specific format
      if (actualCode.includes('&') || actualCode.includes('?') || actualCode.includes(' ')) {
        Alert.alert("Invalid Format", "The reset code contains invalid characters. Please paste only the code part (without &apiKey= or other parameters).");
        return;
      }
      
      console.log("Final OOB code to verify:", actualCode);
      
      // Verify the reset code is valid
      const verifiedEmail = await verifyPasswordResetCode(auth, actualCode);
      console.log("Code verified for email:", verifiedEmail);
      
      // Update the input field with the clean code
      setResetCode(actualCode);
      
      setResetStep(3);
      
    } catch (error) {
      console.error("Code verification error:", error.code, error.message);
      
      let message = "Invalid reset code. Please check and try again.";
      
      if (error.code === "auth/expired-action-code") {
        message = "Reset code has expired (codes expire after 1 hour). Please request a new one.";
      } else if (error.code === "auth/invalid-action-code") {
        message = `Invalid reset code format. 
      
Please make sure you're pasting ONLY the code part that looks like:
M3S3YuPmHUElrG3_N-sx_B9sc1PDMU2M2xtQcAAAGZzvZNrA

NOT the entire string with &apiKey=...`;
      } else if (error.code === "auth/user-disabled") {
        message = "This account has been disabled.";
      } else if (error.code === "auth/user-not-found") {
        message = "No account found for this reset code.";
      }
      
      Alert.alert("Reset Failed", message);
    } finally {
      setResetLoading(false);
    }
  };

  // ✅ Confirm Password Reset - IMPROVED VERSION
  const handleConfirmPasswordReset = async () => {
    if (!newPassword || !confirmNewPassword) {
      Alert.alert("Error", "Please enter and confirm your new password");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password should be at least 6 characters");
      return;
    }

    setResetLoading(true);
    try {
      console.log("Using reset code for confirmation:", resetCode);
      
      // Use the already cleaned code (from verification step)
      let actualCode = resetCode;
      
      // If user went back and modified the code, clean it again
      if (resetCode.includes('http') || resetCode.includes(' ')) {
        actualCode = extractOobCodeFromUrl(resetCode) || cleanOobCode(resetCode);
      }
      
      if (!actualCode) {
        Alert.alert("Error", "Invalid reset code. Please start the reset process again.");
        return;
      }
      
      console.log("Confirming password reset with code:", actualCode);
      
      await confirmPasswordReset(auth, actualCode, newPassword);
      
      Alert.alert(
        "Success!", 
        "Password reset successfully! You can now login with your new password.",
        [{ text: "OK", onPress: resetForgotPasswordFlow }]
      );
      
    } catch (error) {
      console.error("Password reset error:", error.code, error.message);
      
      let message = "Failed to reset password. Please try again.";
      
      if (error.code === "auth/expired-action-code") {
        message = "Reset code has expired. Please request a new reset email.";
      } else if (error.code === "auth/invalid-action-code") {
        message = "Reset code is invalid or already used. Please request a new reset email.";
      } else if (error.code === "auth/user-disabled") {
        message = "This account has been disabled.";
      } else if (error.code === "auth/weak-password") {
        message = "Password is too weak. Please choose a stronger password.";
      }
      
      Alert.alert("Reset Failed", message);
    } finally {
      setResetLoading(false);
    }
  };

  // ✅ Reset the forgot password flow
  const resetForgotPasswordFlow = () => {
    setForgotPasswordModal(false);
    setResetStep(1);
    setResetEmail("");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResetLoading(false);
    Keyboard.dismiss();
  };

  // ✅ Test with a known valid code (for debugging)
  const testWithExampleCode = () => {
    const exampleCode = "M3S3YuPmHUElrG3_N-sx_B9sc1PDMU2M2xtQcAAAGZzvZNrA";
    setResetCode(exampleCode);
    Alert.alert("Test", "Example code filled. Click 'Verify Code' to test.");
  };

  // ✅ Render Code Instructions - IMPROVED VERSION
  const renderCodeInstructions = () => (
    <View style={styles.instructions}>
      <Text style={styles.instructionsTitle}>📋 How to get your reset code CORRECTLY:</Text>
      
      <View style={styles.instructionStep}>
        <Text style={styles.stepNumber}>1</Text>
        <Text style={styles.instructionText}>
          <Text style={styles.highlight}>RECOMMENDED:</Text> Copy the ENTIRE reset link from email
        </Text>
      </View>
      
      <View style={styles.instructionStep}>
        <Text style={styles.stepNumber}>2</Text>
        <Text style={styles.instructionText}>
          <Text style={styles.highlight}>OR:</Text> Copy ONLY the code after "oobCode="
        </Text>
      </View>

      <View style={styles.instructionStep}>
        <Text style={styles.stepNumber}>🚫</Text>
        <Text style={styles.instructionText}>
          <Text style={styles.warning}>DO NOT include</Text> &apiKey=... or &lang=en
        </Text>
      </View>

      <View style={styles.instructionStep}>
        <Text style={styles.stepNumber}>✅</Text>
        <Text style={styles.instructionText}>
          <Text style={styles.success}>Correct format:</Text> M3S3YuPmHUElrG3_N-sx_B9sc1PDMU2M2xtQcAAAGZzvZNrA
        </Text>
      </View>

      <Text style={styles.exampleText}>
        The app will automatically extract the code if you paste the full link!
      </Text>

      <TouchableOpacity 
        style={styles.exampleButton}
        onPress={testWithExampleCode}
      >
        <Text style={styles.exampleButtonText}>Fill with example code format</Text>
      </TouchableOpacity>
    </View>
  );

  // ✅ Render Forgot Password Modal Content based on step
  const renderForgotPasswordContent = () => {
    switch (resetStep) {
      case 1: // Email step
        return (
          <View style={styles.modalStepContainer}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              Enter your email address to receive a reset code
            </Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.icon} />
              <TextInput
                placeholder="Enter your email"
                value={resetEmail}
                onChangeText={setResetEmail}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!resetLoading}
                returnKeyType="done"
                onSubmitEditing={dismissKeyboard}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={resetForgotPasswordFlow}
                disabled={resetLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.primaryButton, resetLoading && { backgroundColor: "#ccc" }]} 
                onPress={handleSendResetEmail}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );

      case 2: // Code verification step
        return (
          <View style={styles.modalStepContainer}>
            <Text style={styles.modalTitle}>Enter Reset Code</Text>
            <Text style={styles.modalSubtitle}>
              Paste the reset code sent to {resetEmail}
            </Text>
            
            {renderCodeInstructions()}
            
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color="#666" style={styles.icon} />
              <TextInput
                placeholder="Paste entire reset link or just the code here..."
                value={resetCode}
                onChangeText={setResetCode}
                style={styles.input}
                autoCapitalize="none"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!resetLoading}
                returnKeyType="done"
                onSubmitEditing={dismissKeyboard}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setResetStep(1)}
                disabled={resetLoading}
              >
                <Text style={styles.cancelButtonText}>Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.primaryButton, resetLoading && { backgroundColor: "#ccc" }]} 
                onPress={handleVerifyCode}
                disabled={resetLoading || !resetCode}
              >
                {resetLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify Code</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );

      case 3: // New password step
        return (
          <View style={styles.modalStepContainer}>
            <Text style={styles.modalTitle}>Create New Password</Text>
            <Text style={styles.modalSubtitle}>
              Enter your new password (minimum 6 characters)
            </Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
              <TextInput
                placeholder="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                style={styles.input}
                secureTextEntry
                editable={!resetLoading}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
              <TextInput
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                style={styles.input}
                secureTextEntry
                editable={!resetLoading}
                returnKeyType="done"
                onSubmitEditing={dismissKeyboard}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setResetStep(2)}
                disabled={resetLoading}
              >
                <Text style={styles.cancelButtonText}>Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.primaryButton, resetLoading && { backgroundColor: "#ccc" }]} 
                onPress={handleConfirmPasswordReset}
                disabled={resetLoading || !newPassword || !confirmNewPassword}
              >
                {resetLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        {/* Your existing header and login form */}
        <View style={styles.header}>
          <Text style={styles.welcomeTitle}>WELCOME{"\n"}TO HOA MIS</Text>
          <Text style={styles.welcomeSubtitle}>
            Welcome to the Management {"\n"}System of the SMUMHOA Inc.
          </Text>
          <Image source={require("./assets/logo.png")} style={styles.logo} />
        </View>

        <View style={styles.form}>
          <Text style={styles.loginTitle}>Login</Text>
          <Text style={styles.loginSubtitle}>
            Please enter the email and password {"\n"}that admin provided for you
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.icon} />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
            <TextInput
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={dismissKeyboard}
            />
          </View>

          <TouchableOpacity onPress={() => setForgotPasswordModal(true)}>
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, loading && { backgroundColor: "#ccc" }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Forgot Password Modal - FIXED VERSION */}
        <Modal
          visible={forgotPasswordModal}
          animationType="slide"
          transparent={true}
          onRequestClose={resetForgotPasswordFlow}
        >
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -500} // Adjust this value
              >
                <View style={styles.modalContent}>
                  <ScrollView 
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {renderForgotPasswordContent()}
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff"
  },
  header: {
    backgroundColor: "#004d40",
    borderBottomRightRadius: 60,
    borderBottomLeftRadius: 60,
    alignItems: "center",
    paddingVertical: 40
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center"
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#e0e0e0",
    textAlign: "center",
    marginVertical: 10
  },
  logo: {
    width: 100,
    height: 100,
    marginTop: 10
  },
  form: {
    padding: 20
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5
  },
  loginSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 10
  },
  input: {
    flex: 1,
    padding: 10,
    minHeight: 40
  },
  icon: {
    marginRight: 5
  },
  forgotPassword: {
    alignSelf: "flex-end",
    color: "#004d40",
    marginBottom: 20,
    fontSize: 12
  },
  button: {
    backgroundColor: "#004d40",
    padding: 15,
    borderRadius: 25,
    alignItems: "center"
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold"
  },
  // Modal Styles - FIXED VERSION
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end", // Changed from "center" to "flex-end"
  },
  keyboardAvoidingView: {
    width: "100%",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
    width: "100%",
    maxHeight: "85%", // Reduced from 80% to 85%
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 20, // Add some bottom padding
  },
  modalStepContainer: {
    minHeight: 200,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
    color: "#004d40"
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20
  },
  instructions: {
    backgroundColor: "#f0f8ff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#004d40"
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#004d40",
    marginBottom: 10
  },
  instructionStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8
  },
  stepNumber: {
    backgroundColor: "#004d40",
    color: "white",
    borderRadius: 10,
    width: 20,
    height: 20,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "bold",
    marginRight: 8,
    lineHeight: 18
  },
  instructionText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
    lineHeight: 16
  },
  highlight: {
    fontWeight: "bold",
    color: "#004d40"
  },
  warning: {
    fontWeight: "bold",
    color: "#d32f2f"
  },
  success: {
    fontWeight: "bold",
    color: "#388e3c"
  },
  exampleText: {
    fontSize: 11,
    color: "#888",
    fontStyle: "italic",
    marginTop: 8,
    backgroundColor: "#f8f8f8",
    padding: 5,
    borderRadius: 5
  },
  exampleButton: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#90caf9',
    borderStyle: 'dashed',
  },
  exampleButtonText: {
    color: '#1976d2',
    fontSize: 12,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 5
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd"
  },
  primaryButton: {
    backgroundColor: "#004d40"
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "bold"
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "bold"
  }
});