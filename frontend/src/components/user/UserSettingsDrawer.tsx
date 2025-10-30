'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { updateEmail as firebaseUpdateEmail, updatePassword as firebaseUpdatePassword } from 'firebase/auth'

import Drawer from '@/components/ui/Drawer'
import { auth } from '@/lib/firebase'
import { useUI } from '@/context/UIContext'
import { useUserProfile } from '@/context/UserProfileContext'
import type { MeasurementSystem, UserProfile } from '@/types/user'

interface FormState {
  firstName: string
  lastName: string
  company: string
  emailNotifications: boolean
  measurementSystem: MeasurementSystem
}

const DEFAULT_FORM: FormState = {
  firstName: '',
  lastName: '',
  company: '',
  emailNotifications: true,
  measurementSystem: 'Metric',
}

export default function UserSettingsDrawer() {
  const { drawers, closeDrawer, showAlert } = useUI()
  const { profile, updateProfile } = useUserProfile()
  const isOpen = Boolean(drawers.userSettings)

  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM)
  const [emailValue, setEmailValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [updatingEmail, setUpdatingEmail] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)

  useEffect(() => {
    if (!profile) return

    setFormState({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      company: profile.company || profile.organization || '',
      emailNotifications: profile.emailNotifications ?? true,
      measurementSystem: profile.measurementSystem || 'Metric',
    })
    setEmailValue('')
    setPasswordValue('')
  }, [profile, isOpen])

  const fullName = useMemo(() => {
    const { firstName, lastName } = formState
    if (firstName && lastName) return `${firstName} ${lastName}`
    return firstName || lastName || undefined
  }, [formState])

  const handleClose = () => closeDrawer('userSettings')

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile) return

    try {
      setSavingProfile(true)
      const updatePayload: Partial<UserProfile> = {
        firstName: formState.firstName.trim() || undefined,
        lastName: formState.lastName.trim() || undefined,
        company: formState.company.trim() || undefined,
        organization: formState.company.trim() || undefined,
        emailNotifications: formState.emailNotifications,
        measurementSystem: formState.measurementSystem,
      }

      if (fullName) {
        updatePayload.name = fullName
      }

      await updateProfile(updatePayload)
      showAlert('Profile updated successfully', 'success')
      handleClose()
    } catch (error: any) {
      showAlert(error?.message || 'Failed to update profile', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleEmailUpdate = async () => {
    if (!emailValue.trim()) {
      showAlert('Enter a new email address', 'warning')
      return
    }

    const currentUser = auth.currentUser
    if (!currentUser) {
      showAlert('No authenticated user found', 'error')
      return
    }

    try {
      setUpdatingEmail(true)
      await firebaseUpdateEmail(currentUser, emailValue.trim())
      await updateProfile({})
      showAlert('Email updated successfully. You may need to verify it via email.', 'success')
      setEmailValue('')
    } catch (error: any) {
      showAlert(error?.message || 'Failed to update email. You may need to reauthenticate.', 'error')
    } finally {
      setUpdatingEmail(false)
    }
  }

  const handlePasswordUpdate = async () => {
    if (!passwordValue.trim()) {
      showAlert('Enter a new password', 'warning')
      return
    }

    const currentUser = auth.currentUser
    if (!currentUser) {
      showAlert('No authenticated user found', 'error')
      return
    }

    try {
      setUpdatingPassword(true)
      await firebaseUpdatePassword(currentUser, passwordValue.trim())
      showAlert('Password updated successfully', 'success')
      setPasswordValue('')
    } catch (error: any) {
      showAlert(error?.message || 'Failed to update password. You may need to reauthenticate.', 'error')
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleInputChange = (key: keyof FormState, value: string | boolean) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="User Settings" position="right">
      <div className="space-y-6">
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                value={formState.firstName}
                onChange={(event) => handleInputChange('firstName', event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                value={formState.lastName}
                onChange={(event) => handleInputChange('lastName', event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          </div>

          <div>
            <label htmlFor="company" className="block text-sm font-medium text-gray-700">
              Company / Organization
            </label>
            <input
              id="company"
              type="text"
              value={formState.company}
              onChange={(event) => handleInputChange('company', event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="emailNotifications"
              type="checkbox"
              checked={formState.emailNotifications}
              onChange={(event) => handleInputChange('emailNotifications', event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="emailNotifications" className="text-sm text-gray-700">
              Receive email notifications
            </label>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">Measurement System</p>
            <div className="mt-2 space-y-2">
              {(['Metric', 'Imperial'] as MeasurementSystem[]).map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="measurementSystem"
                    value={option}
                    checked={formState.measurementSystem === option}
                    onChange={() => handleInputChange('measurementSystem', option)}
                    className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            {savingProfile ? 'Saving…' : 'Update Profile'}
          </button>
        </form>

        <div className="border-t border-gray-200 pt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Update Email</h3>
            <p className="text-xs text-gray-500">Current: {profile?.email}</p>
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                placeholder="New email address"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <button
                onClick={handleEmailUpdate}
                disabled={updatingEmail}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {updatingEmail ? 'Updating…' : 'Update'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-800">Update Password</h3>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                placeholder="New password"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <button
                onClick={handlePasswordUpdate}
                disabled={updatingPassword}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {updatingPassword ? 'Updating…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

