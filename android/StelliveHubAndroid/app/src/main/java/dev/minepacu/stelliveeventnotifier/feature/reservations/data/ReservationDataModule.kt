package dev.minepacu.stelliveeventnotifier.feature.reservations.data

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object ReservationDataModule {
    @Provides
    @Singleton
    fun provideReservationDatabase(@ApplicationContext context: Context): ReservationDatabase =
        Room.databaseBuilder(context, ReservationDatabase::class.java, "reservations-v1.db").build()
}
