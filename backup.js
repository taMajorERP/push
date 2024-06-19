import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import createSharedAccessToken from './getSasToken';

export default function App() {
  const requestUserPermission = async () => {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Authorization status (enabled):', authStatus);
    } else {
      console.log('Authorization status:', authStatus);
    }
    return enabled;
  };

  useEffect(() => {
    const initializeNotifications = async () => {
      const permissionGranted = await requestUserPermission();
      if (permissionGranted) {
        const token = await messaging().getToken();
        console.log('FCM Token:', token);

        const registrationData = `
        <entry xmlns="http://www.w3.org/2005/Atom">
        <content type="application/xml">
            <FcmV1RegistrationDescription xmlns:i="http://www.w3.org/2001/XMLSchema-instance"
                xmlns="http://schemas.microsoft.com/netservices/2010/10/servicebus/connect">
                <FcmV1RegistrationId>${token}</FcmV1RegistrationId>
            </FcmV1RegistrationDescription>
        </content>
    </entry> 
        `;

        const uri = 'https://pushDemoErp.servicebus.windows.net/pushDemoErp/registrations/?api-version=2015-01';
        const saName = 'DefaultFullSharedAccessSignature';
        const saKey = 'pS9rpD+hkk/v0kWKkVH66ayJpsSM2CP0Aqq4gLap+wY=';

        const sasToken = createSharedAccessToken(uri, saName, saKey);
        console.log('SAS Token:', sasToken);

        try {
          const response = await axios.post(uri, registrationData, {
            headers: {
              'Authorization': sasToken,
              'Content-Type': 'application/atom+xml;type=entry;charset=utf-8',
              'x-ms-version': '2015-01'
            }
          });
          console.log('Registration response:', response.data);
        } catch (error) {
          console.error('Error registering token with Azure:', error.response.data);
        }
      } else {
        console.error('Permission not granted');
        return;
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          sound: true,
        });
      }

      const handlePushNotification = async (remoteMessage) => {
        const notification = {
          title: remoteMessage.notification?.title || 'No Title',
          body: remoteMessage.notification?.body || 'No Body',
          data: remoteMessage.data,
        };

        await Notifications.scheduleNotificationAsync({
          content: notification,
          trigger: { seconds: 5 },
        });
      };

      const unsubscribe = messaging().onMessage(handlePushNotification);

      const handleNotificationClick = async (response) => {
        const screen = response?.notification?.request?.content?.data?.screen;
        if (screen !== null) {
          // Add navigation logic here if needed
        }
      };

      const notificationClickSubscription = Notifications.addNotificationResponseReceivedListener(handleNotificationClick);

      messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        const notification = {
          title: remoteMessage.notification?.title || 'No Title',
          body: remoteMessage.notification?.body || 'No Body',
          data: remoteMessage.data,
        };

        await Notifications.scheduleNotificationAsync({
          content: notification,
          trigger: null,
        });
      });

      messaging().onNotificationOpenedApp((remoteMessage) => {
        // Add navigation logic here if needed
      });

      messaging().getInitialNotification().then((remoteMessage) => {
        if (remoteMessage) {
          // Add navigation logic here if needed
        }
      });

      return () => {
        unsubscribe();
        notificationClickSubscription.remove();
      };
    };

    initializeNotifications();
  }, []);

  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
